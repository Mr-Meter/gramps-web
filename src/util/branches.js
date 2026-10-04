// Pure helpers for branches: tags that restrict a user's write access.

// Only users below Owner can be restricted. Disabled and unconfirmed
// accounts keep their assignment untouched, so they are excluded too.
export function canHaveBranches(role) {
  return role >= 0 && role <= 3
}

// Resolve branch handles to tag objects in the order of the handles,
// skipping handles of unknown (e.g. deleted) tags.
export function resolveBranchTags(handles, tags) {
  if (!Array.isArray(handles)) {
    return []
  }
  return handles
    .map(handle => tags.find(tag => tag.handle === handle))
    .filter(tag => tag !== undefined)
}

// Return a new list with the handle added or removed.
export function toggleBranch(handles, handle) {
  const current = Array.isArray(handles) ? handles : []
  return current.includes(handle)
    ? current.filter(h => h !== handle)
    : [...current, handle]
}

export function isHandleList(value) {
  return Array.isArray(value) && value.every(h => typeof h === 'string')
}
