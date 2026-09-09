// ============================================================
// ROLE HIERARCHY
// Encodes ONE rule in ONE place: "who is allowed to override
// whose bed decisions". Admin > Doctor > Nurse. A nurse cannot
// touch a bed whose active admission was assigned by someone
// ranked above them; a doctor CAN override a nurse's assignment;
// admin can override anyone.
//
// Keeping this as a single small module means if the hierarchy
// ever changes (say, a "senior nurse" role gets added later),
// there's exactly one file to edit instead of hunting through
// every controller that does a role check.
// ============================================================

const RANK = {
  nurse: 1,
  doctor: 2,
  admin: 3,
};

// Can `actorRole` override a bed/admission that was assigned by `ownerRole`?
function canSupersede(actorRole, ownerRole) {
  return (RANK[actorRole] ?? 0) >= (RANK[ownerRole] ?? 0);
}

module.exports = { canSupersede, RANK };
