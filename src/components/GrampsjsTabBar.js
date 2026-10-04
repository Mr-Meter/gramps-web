import {html, css, LitElement} from 'lit'

import '@material/web/tabs/tabs'
import '@material/web/tabs/primary-tab'

import {fireEvent} from '../util.js'
import {sharedStyles} from '../SharedStyles.js'
import {GrampsjsAppStateMixin} from '../mixins/GrampsjsAppStateMixin.js'

// Tab key -> label, in display order. A nested object holds the tabs of a
// page's sub-pages (e.g. /settings/users).
const tabs = {
  people: 'People',
  families: 'Families',
  events: 'Events',
  places: 'Places',
  sources: 'Sources',
  citations: 'Citations',
  repositories: 'Repositories',
  notes: 'Notes',
  settings: {
    user: 'User settings',
    administration: 'Administration',
    users: 'Manage users',
    succession: 'Succession',
    info: 'System Information',
  },
}

const topLevelTabs = Object.fromEntries(
  Object.entries(tabs).filter(([, value]) => typeof value === 'string')
)

// Whether a user with `permissions` (appState.permissions) sees the tab `key`
// of `page`.
export function permissionToSeeTab(page, key, permissions) {
  if (page !== 'settings') {
    return true
  }
  switch (key) {
    case 'administration':
    case 'users':
      return permissions.canManageUsers
    case 'succession':
      return permissions.canEdit
    case 'user':
    case 'info':
      return true
    default:
      return false
  }
}

// The tab strip for `path` (appState.path): the tabs a user with
// `permissions` may see as [key, label] pairs in display order, and the index
// of the active one (-1 when the current page has no visible tab). Null when
// the path has no tab strip.
export function tabStrip(path, permissions) {
  const {page, pageId} = path
  if (!(page in tabs)) {
    return null
  }
  const pageTabs = pageId ? tabs[page] : topLevelTabs
  if (typeof pageTabs !== 'object' || (pageId && !(pageId in pageTabs))) {
    return null
  }
  const visibleTabs = Object.entries(pageTabs).filter(([key]) =>
    permissionToSeeTab(page, key, permissions)
  )
  const currentKey = pageId || page
  return {
    tabs: visibleTabs,
    activeIndex: visibleTabs.findIndex(([key]) => key === currentKey),
  }
}

class GrampsjsTabBar extends GrampsjsAppStateMixin(LitElement) {
  static get styles() {
    return [
      sharedStyles,
      css`
        md-tabs {
          margin: 20px;
          width: max-content;
          max-width: 100%;
        }

        md-primary-tab {
          flex: 0 0 auto;
          width: auto;
        }
      `,
    ]
  }

  render() {
    const strip = tabStrip(this.appState.path, this.appState.permissions)
    if (strip === null) {
      return ''
    }
    return html`
      <md-tabs .activeTabIndex=${strip.activeIndex}>
        ${strip.tabs.map(
          ([key, label]) =>
            html`
              <md-primary-tab @click="${() => this._goTo(key)}"
                >${this._(label)}</md-primary-tab
              >
            `
        )}
      </md-tabs>
    `
  }

  _goTo(key) {
    if (this.appState.path.pageId) {
      fireEvent(this, 'nav', {path: `${this.appState.path.page}/${key}`})
    } else {
      fireEvent(this, 'nav', {path: key})
    }
  }
}

window.customElements.define('grampsjs-tab-bar', GrampsjsTabBar)
