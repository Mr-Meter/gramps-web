import {describe, it, expect} from 'vitest'
import {
  DEFAULT_GRACE_DAYS,
  DEFAULT_REQUIRED_CONFIRMATIONS,
  MAX_GRACE_DAYS,
  MAX_REQUIRED_CONFIRMATIONS,
  addSuccessor,
  buildPlanPayload,
  canCancelPlan,
  candidatesUrl,
  countChangedPlans,
  excludeUser,
  formErrors,
  formFromPlan,
  formatTimestamp,
  hasOpenOwnPlan,
  isFormValid,
  isOpenPlan,
  moveItem,
  parseBoundedInt,
  parseUtc,
  personLabel,
  planUserName,
  remainingCandidates,
  removeAt,
  splitPlans,
  stateLabelKey,
  successorNames,
  userDisplayName,
  userLabel,
  userLookup,
} from '../../src/util/succession.js'

const alice = {name: 'alice', full_name: 'Alice Smith', role: 3}
const bob = {name: 'bob', full_name: '', role: 2}
const carol = {name: 'carol', full_name: 'Carol Jones', role: 3}

const ownPlan = {
  id: 1,
  user: alice,
  person_handle: 'h1',
  person: {gramps_id: 'I0001', name: 'Alice Smith'},
  required_confirmations: 3,
  grace_days: 14,
  state: 'pending',
  successors: [bob, carol],
  confirmations: [],
  is_own: true,
  can_confirm: false,
}

const otherPlan = {
  ...ownPlan,
  id: 2,
  user: carol,
  state: 'active',
  is_own: false,
  can_confirm: false,
}

describe('parseUtc', () => {
  it('reads a suffix-less timestamp as UTC', () => {
    expect(parseUtc('2026-10-04T12:00:00').toISOString()).toBe(
      '2026-10-04T12:00:00.000Z'
    )
  })

  it('keeps an explicit timezone', () => {
    expect(parseUtc('2026-10-04T12:00:00Z').toISOString()).toBe(
      '2026-10-04T12:00:00.000Z'
    )
    expect(parseUtc('2026-10-04T12:00:00+02:00').toISOString()).toBe(
      '2026-10-04T10:00:00.000Z'
    )
  })

  it('returns null for missing or invalid values', () => {
    expect(parseUtc(null)).toBeNull()
    expect(parseUtc('')).toBeNull()
    expect(parseUtc('not a date')).toBeNull()
  })
})

describe('formatTimestamp', () => {
  it('returns an empty string without a value', () => {
    expect(formatTimestamp(null, 'en')).toBe('')
  })

  it('formats in the requested language', () => {
    const en = formatTimestamp('2026-10-04T12:00:00', 'en')
    const de = formatTimestamp('2026-10-04T12:00:00', 'de')
    expect(en).toContain('2026')
    expect(de).toContain('2026')
    expect(en).not.toBe(de)
  })

  it('accepts Gramps language codes with an underscore', () => {
    expect(formatTimestamp('2026-10-04T12:00:00', 'pt_BR')).toContain('2026')
  })
})

describe('plan state helpers', () => {
  it('maps each state to its label key', () => {
    expect(stateLabelKey({state: 'active'})).toBe('Active')
    expect(stateLabelKey({state: 'pending'})).toBe(
      'Death recorded - waiting for confirmations'
    )
    expect(stateLabelKey({state: 'confirmed'})).toBe(
      'Confirmed - handover on %s'
    )
    expect(stateLabelKey({state: 'executed'})).toBe('Executed')
  })

  it('falls back to the raw state for unknown states', () => {
    expect(stateLabelKey({state: 'weird'})).toBe('weird')
    expect(stateLabelKey(null)).toBe('')
  })

  it('knows which plans are open and which can be cancelled', () => {
    expect(isOpenPlan({state: 'active'})).toBe(true)
    expect(isOpenPlan({state: 'executed'})).toBe(false)
    expect(canCancelPlan({state: 'active'})).toBe(false)
    expect(canCancelPlan({state: 'pending'})).toBe(true)
    expect(canCancelPlan({state: 'confirmed'})).toBe(true)
    expect(canCancelPlan({state: 'executed'})).toBe(false)
  })
})

describe('name helpers', () => {
  it('prefers the full name, falling back to the username', () => {
    expect(userDisplayName(alice)).toBe('Alice Smith')
    expect(userDisplayName(bob)).toBe('bob')
    expect(userDisplayName(null)).toBe('')
  })

  it('labels users with full name and username', () => {
    expect(userLabel(alice)).toBe('Alice Smith (alice)')
    expect(userLabel(bob)).toBe('bob')
    expect(userLabel({full_name: 'Nameless'})).toBe('Nameless')
    expect(userLabel(undefined)).toBe('')
  })

  it('lists successor names in order', () => {
    expect(successorNames(ownPlan)).toEqual(['bob', 'Carol Jones'])
    expect(successorNames({})).toEqual([])
  })

  it('labels the linked person with the Gramps ID', () => {
    expect(personLabel(ownPlan.person)).toBe('Alice Smith (I0001)')
    expect(personLabel({gramps_id: 'I0002'})).toBe('I0002')
    expect(personLabel(null)).toBe('')
  })
})

describe('splitPlans and hasOpenOwnPlan', () => {
  it('separates own plans from the others', () => {
    expect(splitPlans([ownPlan, otherPlan])).toEqual({
      own: [ownPlan],
      others: [otherPlan],
    })
    expect(splitPlans(undefined)).toEqual({own: [], others: []})
  })

  it('reports whether the user still has an open plan', () => {
    expect(hasOpenOwnPlan([ownPlan, otherPlan])).toBe(true)
    expect(hasOpenOwnPlan([{...ownPlan, state: 'executed'}])).toBe(false)
    expect(hasOpenOwnPlan([otherPlan])).toBe(false)
  })
})

describe('candidatesUrl', () => {
  it('asks for the candidates of the caller without a user', () => {
    expect(candidatesUrl()).toBe('/api/succession/candidates/')
    expect(candidatesUrl('')).toBe('/api/succession/candidates/')
  })

  it('asks for the candidates of another user with the name encoded', () => {
    expect(candidatesUrl('bob')).toBe('/api/succession/candidates/?user=bob')
    expect(candidatesUrl('a b&c/d?')).toBe(
      '/api/succession/candidates/?user=a%20b%26c%2Fd%3F'
    )
  })
})

describe('planUserName', () => {
  it('prefers the user of an existing plan over the form', () => {
    expect(planUserName(otherPlan, {user: 'bob'})).toBe('carol')
  })

  it('falls back to the user chosen in the form, else empty', () => {
    expect(planUserName(null, {user: 'bob'})).toBe('bob')
    expect(planUserName(null, formFromPlan(null))).toBe('')
    expect(planUserName(undefined, undefined)).toBe('')
  })
})

describe('excludeUser', () => {
  it('leaves out the named user', () => {
    expect(excludeUser([alice, bob, carol], 'bob')).toEqual([alice, carol])
  })

  it('keeps everybody without a name or when the user is absent', () => {
    expect(excludeUser([alice, bob], '')).toEqual([alice, bob])
    expect(excludeUser([alice, bob], 'nobody')).toEqual([alice, bob])
    expect(excludeUser(undefined, 'alice')).toEqual([])
  })
})

describe('successor list helpers', () => {
  it('offers only candidates not yet chosen and not the plan owner', () => {
    expect(remainingCandidates([alice, bob, carol], ['bob'], 'carol')).toEqual([
      alice,
    ])
    expect(remainingCandidates([alice, bob], [], '')).toEqual([alice, bob])
    expect(remainingCandidates(undefined, undefined)).toEqual([])
  })

  it('drops the plan owner even when the API still lists them', () => {
    expect(remainingCandidates([alice, bob, carol], [], 'carol')).toEqual([
      alice,
      bob,
    ])
    expect(remainingCandidates([carol], ['bob'], 'carol')).toEqual([])
  })

  it('adds a successor once', () => {
    expect(addSuccessor(['bob'], 'carol')).toEqual(['bob', 'carol'])
    expect(addSuccessor(['bob'], 'bob')).toEqual(['bob'])
    expect(addSuccessor(['bob'], '')).toEqual(['bob'])
  })

  it('removes by index without mutating', () => {
    const list = ['a', 'b', 'c']
    expect(removeAt(list, 1)).toEqual(['a', 'c'])
    expect(list).toEqual(['a', 'b', 'c'])
  })

  it('moves items and ignores out-of-range moves', () => {
    const list = ['a', 'b', 'c']
    expect(moveItem(list, 0, 1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(list, 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItem(list, 0, -1)).toBe(list)
    expect(moveItem(list, 2, 3)).toBe(list)
    expect(moveItem(list, 1, 1)).toBe(list)
    expect(list).toEqual(['a', 'b', 'c'])
  })

  it('looks users up by name from candidates and plan successors', () => {
    const lookup = userLookup([alice], ownPlan)
    expect(lookup.alice).toBe(alice)
    expect(lookup.carol).toBe(carol)
    expect(lookup.nobody).toBeUndefined()
  })
})

describe('parseBoundedInt', () => {
  it('accepts whole numbers within the bounds', () => {
    expect(parseBoundedInt('2', 0, 100)).toBe(2)
    expect(parseBoundedInt(' 0 ', 0, 100)).toBe(0)
    expect(parseBoundedInt(100, 0, 100)).toBe(100)
  })

  it('rejects anything else', () => {
    expect(parseBoundedInt('101', 0, 100)).toBeNull()
    expect(parseBoundedInt('-1', 0, 100)).toBeNull()
    expect(parseBoundedInt('1.5', 0, 100)).toBeNull()
    expect(parseBoundedInt('', 0, 100)).toBeNull()
    expect(parseBoundedInt(undefined, 0, 100)).toBeNull()
  })
})

describe('form state', () => {
  it('starts from the defaults without a plan', () => {
    expect(formFromPlan(null)).toEqual({
      user: '',
      personHandle: null,
      personLabel: '',
      successors: [],
      requiredConfirmations: String(DEFAULT_REQUIRED_CONFIRMATIONS),
      graceDays: String(DEFAULT_GRACE_DAYS),
    })
  })

  it('prefills from an existing plan', () => {
    expect(formFromPlan(ownPlan)).toEqual({
      user: 'alice',
      personHandle: 'h1',
      personLabel: 'Alice Smith (I0001)',
      successors: ['bob', 'carol'],
      requiredConfirmations: '3',
      graceDays: '14',
    })
  })

  it('flags invalid fields', () => {
    const form = {
      ...formFromPlan(null),
      requiredConfirmations: String(MAX_REQUIRED_CONFIRMATIONS + 1),
      graceDays: String(MAX_GRACE_DAYS),
    }
    expect(formErrors(form)).toEqual({
      user: true,
      requiredConfirmations: true,
      graceDays: false,
    })
    expect(isFormValid(form)).toBe(false)
    expect(isFormValid({...form, requiredConfirmations: '0'})).toBe(true)
  })

  it('requires a user only when asked to', () => {
    const form = formFromPlan(null)
    expect(isFormValid(form)).toBe(true)
    expect(isFormValid(form, {needsUser: true})).toBe(false)
    expect(isFormValid({...form, user: 'bob'}, {needsUser: true})).toBe(true)
  })
})

describe('buildPlanPayload', () => {
  it('builds the API body with numbers and a null person', () => {
    expect(buildPlanPayload(formFromPlan(null))).toEqual({
      person_handle: null,
      successors: [],
      required_confirmations: DEFAULT_REQUIRED_CONFIRMATIONS,
      grace_days: DEFAULT_GRACE_DAYS,
    })
  })

  it('keeps the person and the successor order', () => {
    const payload = buildPlanPayload(formFromPlan(ownPlan))
    expect(payload).toEqual({
      person_handle: 'h1',
      successors: ['bob', 'carol'],
      required_confirmations: 3,
      grace_days: 14,
    })
    expect(payload.successors).not.toBe(ownPlan.successors)
  })

  it('adds the user only for plans created for somebody else', () => {
    const form = {...formFromPlan(null), user: 'bob'}
    expect(buildPlanPayload(form).user).toBeUndefined()
    expect(buildPlanPayload(form, {withUser: true}).user).toBe('bob')
  })
})

describe('countChangedPlans', () => {
  it('counts the plans with at least one event', () => {
    expect(
      countChangedPlans({
        plans: [
          {id: 1, events: ['death_recorded']},
          {id: 2, events: []},
          {id: 3},
        ],
      })
    ).toBe(1)
    expect(countChangedPlans({})).toBe(0)
    expect(countChangedPlans(undefined)).toBe(0)
  })
})
