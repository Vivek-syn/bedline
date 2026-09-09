import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div>
        <span className="navbar__brand">Bedline</span>
        <span className="navbar__title">{title}</span>
      </div>
      <div className="navbar__user">
        <span>{user?.name} · {user?.role}</span>
        <button className="btn btn--ghost" onClick={handleLogout}>Log out</button>
      </div>
    </header>
  );
}
