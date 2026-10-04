import {describe, it, expect, afterEach} from 'vitest'
import {canEditObject} from '../../src/util.js'
import {
  appStateUpdatePermissions,
  getInitialAppState,
} from '../../src/appState.js'

// Minimal fake JWT; jwtDecode only base64-decodes the payload, so no
// signature is needed.
function makeFakeJwt(claims) {
  const encode = obj =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  return `${encode({alg: 'HS256', typ: 'JWT'})}.${encode(claims)}.sig`
}

const exp = 9999999999

function setToken(claims) {
  localStorage.setItem(
    'access_token',
    makeFakeJwt({permissions: ['EditObject'], exp, ...claims})
  )
}

const unrestricted = {canEdit: true, branches: null}
const restricted = {canEdit: true, branches: ['branch-a', 'branch-b']}

describe('canEditObject', () => {
  it('denies without the EditObject permission', () => {
    const obj = {tag_list: ['branch-a']}
    expect(canEditObject({canEdit: false, branches: null}, obj)).to.be.false
    expect(canEditObject({canEdit: false, branches: ['branch-a']}, obj)).to.be
      .false
    expect(canEditObject(undefined, obj)).to.be.false
  })

  it('allows every object for unrestricted users', () => {
    expect(canEditObject(unrestricted, {tag_list: ['other']})).to.be.true
    expect(canEditObject(unrestricted, {tag_list: []})).to.be.true
    expect(canEditObject(unrestricted, {})).to.be.true
    // permissions object without the branches key
    expect(canEditObject({canEdit: true}, {})).to.be.true
  })

  it('allows objects tagged with one of the user branches', () => {
    expect(canEditObject(restricted, {tag_list: ['branch-b']})).to.be.true
    expect(canEditObject(restricted, {tag_list: ['other', 'branch-a']})).to.be
      .true
  })

  it('denies objects of other branches', () => {
    expect(canEditObject(restricted, {tag_list: ['other']})).to.be.false
    expect(canEditObject(restricted, {tag_list: []})).to.be.false
  })

  it('denies objects without a tag list', () => {
    expect(canEditObject(restricted, {})).to.be.false
    expect(canEditObject(restricted, undefined)).to.be.false
  })

  it('treats an empty branches array as restricted to nothing', () => {
    const permissions = {canEdit: true, branches: []}
    expect(canEditObject(permissions, {tag_list: ['branch-a']})).to.be.false
    expect(canEditObject(permissions, {tag_list: []})).to.be.false
  })
})

describe('permissions.branches', () => {
  afterEach(() => {
    localStorage.removeItem('access_token')
  })

  it('starts as null in the initial app state', () => {
    expect(getInitialAppState().permissions.branches).to.be.null
  })

  it('reads the branches claim from the token', () => {
    setToken({branches: ['branch-a', 'branch-b']})
    const result = appStateUpdatePermissions({permissions: {}})
    expect(result.permissions.branches).to.deep.equal(['branch-a', 'branch-b'])
    expect(result.permissions.canEdit).to.be.true
  })

  it('yields null when the claim is absent', () => {
    setToken({})
    const result = appStateUpdatePermissions({permissions: {}})
    expect(result.permissions.branches).to.be.null
  })

  it('yields null without a token', () => {
    const result = appStateUpdatePermissions({permissions: {}})
    expect(result.permissions.branches).to.be.null
  })

  it('returns the same appState when the permissions did not change', () => {
    setToken({branches: ['branch-a']})
    const first = appStateUpdatePermissions({permissions: {}})
    // the claim is decoded into a fresh array each time
    expect(appStateUpdatePermissions(first)).to.equal(first)

    setToken({})
    const unrestrictedState = appStateUpdatePermissions({permissions: {}})
    expect(appStateUpdatePermissions(unrestrictedState)).to.equal(
      unrestrictedState
    )
  })

  it('returns a new appState when the branches changed', () => {
    setToken({branches: ['branch-a']})
    const first = appStateUpdatePermissions({permissions: {}})

    setToken({branches: ['branch-a', 'branch-b']})
    const second = appStateUpdatePermissions(first)
    expect(second).to.not.equal(first)
    expect(second.permissions.branches).to.deep.equal(['branch-a', 'branch-b'])

    setToken({branches: ['branch-b', 'branch-a']})
    const reordered = appStateUpdatePermissions(second)
    expect(reordered).to.not.equal(second)

    setToken({})
    const lifted = appStateUpdatePermissions(reordered)
    expect(lifted).to.not.equal(reordered)
    expect(lifted.permissions.branches).to.be.null

    setToken({branches: ['branch-a']})
    const imposed = appStateUpdatePermissions(lifted)
    expect(imposed).to.not.equal(lifted)
    expect(imposed.permissions.branches).to.deep.equal(['branch-a'])
  })

  it('does not mutate the original appState', () => {
    setToken({branches: ['branch-a']})
    const state = {permissions: {}}
    appStateUpdatePermissions(state)
    expect(state.permissions).to.deep.equal({})
  })
})
