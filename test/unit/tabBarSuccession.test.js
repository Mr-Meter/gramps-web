import {describe, it, expect} from 'vitest'
import {
  permissionToSeeTab,
  tabStrip,
} from '../../src/components/GrampsjsTabBar.js'

const owner = {canEdit: true, canManageUsers: true}
const editor = {canEdit: true, canManageUsers: false}
const member = {canEdit: false, canManageUsers: false}

const settings = pageId => ({page: 'settings', pageId, pageId2: ''})
const keys = strip => strip.tabs.map(([key]) => key)

describe('settings tab strip', () => {
  it('shows the succession tab to editors, between users and info', () => {
    expect(keys(tabStrip(settings('user'), owner))).toEqual([
      'user',
      'administration',
      'users',
      'succession',
      'info',
    ])
    expect(keys(tabStrip(settings('user'), editor))).toEqual([
      'user',
      'succession',
      'info',
    ])
  })

  it('hides the succession tab from users who cannot edit', () => {
    expect(keys(tabStrip(settings('user'), member))).toEqual(['user', 'info'])
    expect(permissionToSeeTab('settings', 'succession', member)).toBe(false)
    expect(permissionToSeeTab('settings', 'succession', editor)).toBe(true)
  })

  it('labels the tab with the Succession translation key', () => {
    expect(tabStrip(settings('succession'), editor).tabs).toContainEqual([
      'succession',
      'Succession',
    ])
  })

  it('highlights the succession tab on /settings/succession', () => {
    expect(tabStrip(settings('succession'), owner).activeIndex).toBe(3)
    expect(tabStrip(settings('succession'), editor).activeIndex).toBe(1)
    expect(tabStrip(settings('info'), editor).activeIndex).toBe(2)
  })

  it('highlights no tab when the page is hidden from the user', () => {
    expect(tabStrip(settings('succession'), member).activeIndex).toBe(-1)
  })

  it('leaves the other strips unchanged', () => {
    expect(tabStrip({page: 'home', pageId: ''}, owner)).toBeNull()
    expect(tabStrip(settings('unknown'), owner)).toBeNull()
    const people = tabStrip({page: 'people', pageId: ''}, member)
    expect(keys(people)).toEqual([
      'people',
      'families',
      'events',
      'places',
      'sources',
      'citations',
      'repositories',
      'notes',
    ])
    expect(people.activeIndex).toBe(0)
  })
})
