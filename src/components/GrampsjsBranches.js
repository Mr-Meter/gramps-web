/*
Overview of the branches of the tree and the users restricted to them
*/

import {css, html} from 'lit'

import {sharedStyles} from '../SharedStyles.js'
import {GrampsjsConnectedComponent} from './GrampsjsConnectedComponent.js'
import {userRoles} from './GrampsjsFormUser.js'
import './GrampsjsTagsSmall.js'

export class GrampsjsBranches extends GrampsjsConnectedComponent {
  static get styles() {
    return [
      sharedStyles,
      css`
        table {
          font-size: 15px;
          border-collapse: collapse;
          border-spacing: 0;
        }

        th {
          font-size: 14px;
          color: var(--grampsjs-body-font-color-60);
          font-weight: 400;
        }

        th,
        td {
          padding: 14px 20px;
          border-bottom: 1px solid var(--grampsjs-body-font-color-10);
          text-align: left;
          vertical-align: top;
        }

        th:first-child,
        td:first-child {
          padding-left: 0;
        }

        .deleted {
          font-size: 14px;
          color: var(--grampsjs-body-font-color-50);
        }

        .deleted code {
          font-size: 12px;
        }

        .user + .user {
          margin-top: 6px;
        }
      `,
    ]
  }

  renderContent() {
    const branches = this._data.data ?? []
    if (branches.length === 0) {
      return html`<p>
        ${this._('No branch administrators have been assigned yet.')}
      </p>`
    }
    return html`
      <table>
        <tr>
          <th>${this._('Branch')}</th>
          <th>${this._('Branch administrators')}</th>
        </tr>
        ${branches.map(
          branch => html`
            <tr>
              <td>${this._renderTag(branch)}</td>
              <td>
                ${branch.users.map(
                  user =>
                    html`<div class="user">${this._formatUser(user)}</div>`
                )}
              </td>
            </tr>
          `
        )}
      </table>
    `
  }

  // eslint-disable-next-line class-methods-use-this
  renderLoading() {
    return html`<p>
      <span class="skeleton" style="width: 18em;">&nbsp;</span>
    </p>`
  }

  _renderTag(branch) {
    if (branch.name === null) {
      return html`<span class="deleted"
        >${this._('deleted tag')} <code>${branch.handle}</code></span
      >`
    }
    return html`<grampsjs-tags-small .data="${[branch]}"></grampsjs-tags-small>`
  }

  _formatUser(user) {
    const role = this._(userRoles[user.role])
    return user.full_name
      ? `${user.full_name} (${user.name}) – ${role}`
      : `${user.name} – ${role}`
  }

  // eslint-disable-next-line class-methods-use-this
  getUrl() {
    return '/api/branches/'
  }
}

window.customElements.define('grampsjs-branches', GrampsjsBranches)
