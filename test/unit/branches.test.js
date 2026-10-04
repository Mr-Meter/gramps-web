import {describe, it, expect} from 'vitest'
import {
  canHaveBranches,
  resolveBranchTags,
  toggleBranch,
  isHandleList,
} from '../../src/util/branches.js'

const tags = [
  {handle: 'h1', name: 'Smith', color: '#ff0000'},
  {handle: 'h2', name: 'Miller', color: '#00ff00'},
  {handle: 'h3', name: 'ToDo', color: '#0000ff'},
]

describe('canHaveBranches', () => {
  it('allows Guest to Editor', () => {
    expect(canHaveBranches(0)).to.be.true
    expect(canHaveBranches(1)).to.be.true
    expect(canHaveBranches(2)).to.be.true
    expect(canHaveBranches(3)).to.be.true
  })

  it('excludes Owner and Administrator', () => {
    expect(canHaveBranches(4)).to.be.false
    expect(canHaveBranches(5)).to.be.false
  })

  it('excludes disabled and unconfirmed accounts', () => {
    expect(canHaveBranches(-1)).to.be.false
    expect(canHaveBranches(-2)).to.be.false
  })
})

describe('resolveBranchTags', () => {
  it('resolves handles to tag objects in handle order', () => {
    expect(resolveBranchTags(['h3', 'h1'], tags)).to.deep.equal([
      tags[2],
      tags[0],
    ])
  })

  it('skips unknown handles', () => {
    expect(resolveBranchTags(['h2', 'gone'], tags)).to.deep.equal([tags[1]])
  })

  it('returns an empty list for missing or empty handles', () => {
    expect(resolveBranchTags(undefined, tags)).to.deep.equal([])
    expect(resolveBranchTags(null, tags)).to.deep.equal([])
    expect(resolveBranchTags([], tags)).to.deep.equal([])
  })

  it('returns an empty list when no tags are known', () => {
    expect(resolveBranchTags(['h1'], [])).to.deep.equal([])
  })
})

describe('toggleBranch', () => {
  it('adds a handle that is not present', () => {
    expect(toggleBranch(['h1'], 'h2')).to.deep.equal(['h1', 'h2'])
  })

  it('removes a handle that is present', () => {
    expect(toggleBranch(['h1', 'h2'], 'h1')).to.deep.equal(['h2'])
  })

  it('treats a missing list as empty', () => {
    expect(toggleBranch(undefined, 'h1')).to.deep.equal(['h1'])
  })

  it('does not mutate the original list', () => {
    const handles = ['h1']
    toggleBranch(handles, 'h2')
    toggleBranch(handles, 'h1')
    expect(handles).to.deep.equal(['h1'])
  })
})

describe('isHandleList', () => {
  it('accepts a list of strings', () => {
    expect(isHandleList([])).to.be.true
    expect(isHandleList(['h1', 'h2'])).to.be.true
  })

  it('rejects anything else', () => {
    expect(isHandleList(undefined)).to.be.false
    expect(isHandleList('h1')).to.be.false
    expect(isHandleList(['h1', 2])).to.be.false
    expect(isHandleList([{handle: 'h1'}])).to.be.false
  })
})
