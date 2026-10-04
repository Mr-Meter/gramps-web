/*
Pure helpers for the succession page (/settings/succession)
*/

export const DEFAULT_REQUIRED_CONFIRMATIONS = 2
export const DEFAULT_GRACE_DAYS = 7
export const MAX_REQUIRED_CONFIRMATIONS = 100
export const MAX_GRACE_DAYS = 3650

const STATE_LABEL_KEYS = {
  active: 'Active',
  pending: 'Death recorded - waiting for confirmations',
  confirmed: 'Confirmed - handover on %s',
  executed: 'Executed',
}

// The API sends timestamps in UTC without a timezone suffix, which Date would
// otherwise read as local time.
export function parseUtc(value) {
  if (!value) {
    return null
  }
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value)
  const date = new Date(hasZone ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatTimestamp(value, lang = 'en') {
  const date = parseUtc(value)
  if (!date) {
    return ''
  }
  try {
    return date.toLocaleString((lang || 'en').replace('_', '-'))
  } catch {
    return date.toLocaleString('en')
  }
}

// Translation key of the plan state; the confirmed label takes the handover
// date as %s.
export function stateLabelKey(plan) {
  return STATE_LABEL_KEYS[plan?.state] ?? plan?.state ?? ''
}

export function isOpenPlan(plan) {
  return plan?.state !== 'executed'
}

export function canCancelPlan(plan) {
  return plan?.state === 'pending' || plan?.state === 'confirmed'
}

export function userDisplayName(user) {
  return user?.full_name || user?.name || ''
}

export function userLabel(user) {
  if (!user?.name) {
    return user?.full_name || ''
  }
  return user.full_name ? `${user.full_name} (${user.name})` : user.name
}

export function successorNames(plan) {
  return (plan?.successors ?? []).map(userDisplayName)
}

export function personLabel(person) {
  if (!person) {
    return ''
  }
  if (person.name && person.gramps_id) {
    return `${person.name} (${person.gramps_id})`
  }
  return person.name || person.gramps_id || ''
}

export function splitPlans(plans) {
  const list = Array.isArray(plans) ? plans : []
  return {
    own: list.filter(plan => plan.is_own),
    others: list.filter(plan => !plan.is_own),
  }
}

export function hasOpenOwnPlan(plans) {
  return splitPlans(plans).own.some(isOpenPlan)
}

// GET URL of the users who can be named as successors: of the caller or, for
// managers, of another user, who is then left out instead of the caller.
export function candidatesUrl(userName = '') {
  const base = '/api/succession/candidates/'
  return userName ? `${base}?user=${encodeURIComponent(userName)}` : base
}

// Username the form's plan is for: that of the existing plan or, when a
// manager creates a plan for somebody else, the user chosen in the form.
export function planUserName(plan, form) {
  return plan?.user?.name || form?.user || ''
}

// Users other than the named one. The API already leaves out the caller or
// the plan's user, but a stale answer must not offer somebody as their own
// successor, nor a manager as the user of a plan they create for another.
export function excludeUser(users, name) {
  return (users ?? []).filter(user => !name || user.name !== name)
}

// Users that can still be added as successors: not chosen yet and not the
// user whose plan it is.
export function remainingCandidates(candidates, successors, planUser = '') {
  const taken = new Set(successors ?? [])
  return excludeUser(candidates, planUser).filter(user => !taken.has(user.name))
}

export function addSuccessor(successors, name) {
  if (!name || successors.includes(name)) {
    return successors
  }
  return [...successors, name]
}

export function removeAt(list, index) {
  return list.filter((item, i) => i !== index)
}

export function moveItem(list, from, to) {
  const outOfRange = index => index < 0 || index >= list.length
  if (from === to || outOfRange(from) || outOfRange(to)) {
    return list
  }
  const result = [...list]
  const [item] = result.splice(from, 1)
  result.splice(to, 0, item)
  return result
}

// The integer within [min, max] that the field text denotes, else null.
export function parseBoundedInt(value, min, max) {
  const text = String(value ?? '').trim()
  if (!/^-?\d+$/.test(text)) {
    return null
  }
  const number = Number(text)
  return number >= min && number <= max ? number : null
}

// Users by username, from the candidates and the plan's current successors,
// which may include users the candidate list does not offer.
export function userLookup(candidates, plan) {
  return Object.fromEntries(
    [...(candidates ?? []), ...(plan?.successors ?? [])].map(user => [
      user.name,
      user,
    ])
  )
}

// Number fields hold the field text so that partial input survives a render.
export function formFromPlan(plan) {
  return {
    user: plan?.user?.name ?? '',
    personHandle: plan?.person_handle ?? null,
    personLabel: personLabel(plan?.person),
    successors: (plan?.successors ?? []).map(user => user.name),
    requiredConfirmations: String(
      plan?.required_confirmations ?? DEFAULT_REQUIRED_CONFIRMATIONS
    ),
    graceDays: String(plan?.grace_days ?? DEFAULT_GRACE_DAYS),
  }
}

export function formErrors(form) {
  return {
    user: !form.user,
    requiredConfirmations:
      parseBoundedInt(
        form.requiredConfirmations,
        0,
        MAX_REQUIRED_CONFIRMATIONS
      ) === null,
    graceDays: parseBoundedInt(form.graceDays, 0, MAX_GRACE_DAYS) === null,
  }
}

export function isFormValid(form, {needsUser = false} = {}) {
  const errors = formErrors(form)
  return (
    !errors.requiredConfirmations &&
    !errors.graceDays &&
    !(needsUser && errors.user)
  )
}

// Body of POST /api/succession/ and PUT /api/succession/<id>/. The user is
// only sent when a manager creates a plan for somebody else.
export function buildPlanPayload(form, {withUser = false} = {}) {
  const payload = {
    person_handle: form.personHandle || null,
    successors: [...form.successors],
    required_confirmations: parseBoundedInt(
      form.requiredConfirmations,
      0,
      MAX_REQUIRED_CONFIRMATIONS
    ),
    grace_days: parseBoundedInt(form.graceDays, 0, MAX_GRACE_DAYS),
  }
  if (withUser) {
    payload.user = form.user
  }
  return payload
}

// Number of plans that POST /api/succession/check/ reported events for.
export function countChangedPlans(result) {
  return (result?.plans ?? []).filter(plan => (plan.events ?? []).length > 0)
    .length
}
