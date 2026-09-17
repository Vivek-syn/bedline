// ============================================================
// ROLES AND PERMISSIONS
//
// The admin builds a role here by ticking permissions, grouped by
// the module that owns them — which is exactly how the backend
// registry describes them, so the checklist reorganises itself
// when a module is added.
//
// Two things the UI is careful about:
//
//   Permissions the signed-in admin does not hold themselves are
//   shown, but disabled and labelled. The server would refuse the
//   grant anyway; showing them greyed out explains *why* a box
//   cannot be ticked instead of hiding the rule.
//
//   Dangerous permissions are marked inline. Someone granting
//   "discharge before dues are cleared" should see what it means
//   at the moment they tick it, not in documentation.
// ============================================================

import { useCallback, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import useModuleData from '../lib/useModuleData';
import { Notice, Field, Empty, Spinner, fieldErrors, firstError } from '../components/ui';

const BLANK = { name: '', description: '', rank: 10, permissionIds: [] };

export default function Roles() {
  const { can, role: myRole, reload: reloadSession } = useAuth();

  const load = useCallback(async () => {
    const [roles, catalogue] = await Promise.all([
      api.get('/roles'),
      api.get('/roles/catalogue'),
    ]);
    return { roles, catalogue };
  }, []);

  const { data, loading, error, reload } = useModuleData(load);

  const [editing, setEditing] = useState(null); // role id, or 'new'
  const [draft, setDraft] = useState(BLANK);
  const [message, setMessage] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  const allPermissions = useMemo(
    () => (data?.catalogue || []).flatMap((module) => module.permissions),
    [data]
  );

  function startNew() {
    setEditing('new');
    setDraft(BLANK);
    setSaveError(null);
  }

  function startEdit(role) {
    setEditing(role.id);
    setDraft({
      name: role.name,
      description: role.description || '',
      rank: role.rank,
      permissionIds: [...role.permission_ids],
    });
    setSaveError(null);
  }

  function togglePermission(permissionId) {
    setDraft((current) => ({
      ...current,
      permissionIds: current.permissionIds.includes(permissionId)
        ? current.permissionIds.filter((id) => id !== permissionId)
        : [...current.permissionIds, permissionId],
    }));
  }

  function toggleModule(module, on) {
    const grantable = module.permissions
      .filter((permission) => can(permission.key))
      .map((permission) => permission.id);

    setDraft((current) => ({
      ...current,
      permissionIds: on
        ? [...new Set([...current.permissionIds, ...grantable])]
        : current.permissionIds.filter((id) => !grantable.includes(id)),
    }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);

    try {
      const body = {
        name: draft.name,
        description: draft.description,
        rank: Number(draft.rank),
        permissionIds: draft.permissionIds,
      };

      if (editing === 'new') {
        await api.post('/roles', body);
        setMessage(`Role “${draft.name}” created.`);
      } else {
        await api.patch(`/roles/${editing}`, body);
        setMessage(`Role “${draft.name}” updated. Anyone signed in under it gets the change immediately.`);
      }

      setEditing(null);
      await reload();
      // If the admin just edited their own role, their sidebar
      // needs to reflect it without a sign-out.
      if (editing === myRole?.id) await reloadSession();
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  async function remove(role) {
    if (!window.confirm(`Delete the role “${role.name}”? This cannot be undone.`)) return;
    try {
      await api.delete(`/roles/${role.id}`);
      setMessage(`Role “${role.name}” deleted.`);
      await reload();
    } catch (err) {
      setSaveError(err);
    }
  }

  if (loading) return <Spinner label="Loading roles" />;
  if (error) return <Notice tone="error">{error.message}</Notice>;

  const errors = fieldErrors(saveError);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Roles and permissions</h1>
          <p className="page__sub">
            A role is a bundle of permissions. Changing one takes effect for everyone holding it, straight away.
          </p>
        </div>
        {can('role.manage') && editing === null && (
          <button type="button" className="btn btn--primary" onClick={startNew}>New role</button>
        )}
      </header>

      <Notice tone="ok" onDismiss={() => setMessage(null)}>{message}</Notice>
      {saveError && <Notice tone="error" onDismiss={() => setSaveError(null)}>{saveError.message}</Notice>}

      {editing !== null && (
        <form className="editor" onSubmit={save}>
          <h2>{editing === 'new' ? 'New role' : `Editing ${draft.name}`}</h2>

          <div className="editor__row">
            <Field label="Role name" error={firstError(errors, 'name')}>
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="Ward Clerk"
                required
              />
            </Field>

            <Field
              label="Seniority rank"
              error={firstError(errors, 'rank')}
              hint={`1–${myRole?.rank ?? 90}. A bed decision can only be undone by an equal or higher rank.`}
            >
              <input
                type="number"
                min="1"
                max={myRole?.rank ?? 90}
                value={draft.rank}
                onChange={(event) => setDraft({ ...draft, rank: event.target.value })}
                required
              />
            </Field>
          </div>

          <Field label="Description" error={firstError(errors, 'description')}>
            <input
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="What this role is for"
            />
          </Field>

          <h3 className="editor__heading">
            What this role can reach
            <span className="editor__count">{draft.permissionIds.length} selected</span>
          </h3>

          <div className="matrix">
            {data.catalogue.map((module) => {
              const grantable = module.permissions.filter((permission) => can(permission.key));
              const allOn = grantable.length > 0
                && grantable.every((permission) => draft.permissionIds.includes(permission.id));

              return (
                <fieldset key={module.key} className="matrix__module">
                  <legend>
                    <span className="matrix__name">{module.name}</span>
                    {grantable.length > 0 && (
                      <button
                        type="button"
                        className="btn btn--tiny btn--ghost"
                        onClick={() => toggleModule(module, !allOn)}
                      >
                        {allOn ? 'Clear' : 'Select all'}
                      </button>
                    )}
                  </legend>

                  {module.permissions.map((permission) => {
                    const holdable = can(permission.key);
                    return (
                      <label
                        key={permission.id}
                        className={`matrix__item${holdable ? '' : ' matrix__item--locked'}`}
                      >
                        <input
                          type="checkbox"
                          checked={draft.permissionIds.includes(permission.id)}
                          disabled={!holdable}
                          onChange={() => togglePermission(permission.id)}
                        />
                        <span className="matrix__text">
                          <span className="matrix__title">
                            {permission.name}
                            {permission.dangerous && <span className="tag tag--danger">sensitive</span>}
                          </span>
                          <span className="matrix__desc">
                            {holdable ? permission.description : 'You don’t hold this permission, so you can’t grant it.'}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>

          <div className="editor__actions">
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving…' : editing === 'new' ? 'Create role' : 'Save changes'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>Role</th><th>Rank</th><th>Permissions</th><th>People</th><th />
          </tr>
        </thead>
        <tbody>
          {data.roles.map((role) => (
            <tr key={role.id}>
              <td>
                <span className="table__strong">{role.name}</span>
                {role.is_protected && <span className="tag">protected</span>}
                {role.is_system && !role.is_protected && <span className="tag">built-in</span>}
                {role.description && <span className="table__sub">{role.description}</span>}
              </td>
              <td>{role.rank}</td>
              <td>
                {role.permission_keys.length}
                <span className="table__sub">
                  of {allPermissions.length}
                </span>
              </td>
              <td>{role.user_count}</td>
              <td className="table__actions">
                {can('role.manage') && !role.is_protected && (
                  <button type="button" className="btn btn--small btn--ghost" onClick={() => startEdit(role)}>
                    Edit
                  </button>
                )}
                {can('role.delete') && !role.is_system && role.user_count === 0 && (
                  <button type="button" className="btn btn--small btn--danger" onClick={() => remove(role)}>
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.roles.length === 0 && <Empty title="No roles yet" />}
    </div>
  );
}
