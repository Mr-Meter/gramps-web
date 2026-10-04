/*
Card showing one succession plan with its actions
*/

import {html, css, LitElement} from 'lit'

import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'

import {mdiAccountCheck, mdiHeartPulse} from '@mdi/js'

import {sharedStyles} from '../SharedStyles.js'
import {GrampsjsAppStateMixin} from '../mixins/GrampsjsAppStateMixin.js'
import {fireEvent} from '../util.js'
import {userRoles} from './GrampsjsFormUser.js'
import './GrampsjsIcon.js'
import './GrampsjsObjectLink.js'
import {
  canCancelPlan,
  formatTimestamp,
  isOpenPlan,
  stateLabelKey,
  successorNames,
  userDisplayName,
  userLabel,
} from '../util/succession.js'

class GrampsjsSuccessionPlan extends GrampsjsAppStateMixin(LitElement) {
  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          display: block;
          max-width: 720px;
        }

        .card {
          --state-color: var(--grampsjs-body-font-color-40);
          border: 1px solid var(--grampsjs-body-font-color-15);
          border-left: 5px solid var(--state-color);
          border-radius: 12px;
          padding: 1em 1.4em;
          margin: 1em 0;
        }

        .card.state-active {
          --state-color: var(--grampsjs-alert-success-font-color);
        }

        .card.state-pending {
          --state-color: var(--grampsjs-alert-warn-font-color);
        }

        .card.state-confirmed {
          --state-color: var(--grampsjs-alert-error-font-color);
        }

        .header {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.3em 1em;
        }

        .title {
          font-weight: 500;
        }

        .state {
          color: var(--state-color);
          font-weight: 500;
          font-size: 0.9em;
        }

        dl {
          display: grid;
          grid-template-columns: max-content 1fr;
          gap: 4px 16px;
          margin: 1em 0;
        }

        dd {
          padding: 0;
        }

        ol,
        ul {
          margin: 0;
          padding-left: 1.3em;
        }

        .small {
          font-size: 0.85em;
          color: var(--grampsjs-body-font-color-60);
        }

        p {
          margin: 0.6em 0;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 1em;
        }
      `,
    ]
  }

  static get properties() {
    return {
      plan: {type: Object},
      compact: {type: Boolean},
      canManage: {type: Boolean},
      busy: {type: Boolean},
    }
  }

  constructor() {
    super()
    this.plan = null
    this.compact = false
    this.canManage = false
    this.busy = false
  }

  get _lang() {
    return this.appState?.i18n?.lang || 'en'
  }

  render() {
    const {plan} = this
    if (!plan) {
      return ''
    }
    const actions = this._renderActions()
    return html`
      <div class="card state-${plan.state}">
        <div class="header">
          <span class="title">
            ${userLabel(plan.user)}
            ${plan.user?.role in userRoles
              ? html`<span class="small">
                  &middot; ${this._(userRoles[plan.user.role])}
                </span>`
              : ''}
          </span>
          <span class="state">
            ${this._(
              stateLabelKey(plan),
              formatTimestamp(plan.execute_after, this._lang)
            )}
          </span>
        </div>
        ${this.compact ? this._renderCompactDetails() : this._renderDetails()}
        ${this._renderHistory()}
        ${actions.length ? html`<div class="actions">${actions}</div>` : ''}
      </div>
    `
  }

  _renderPerson() {
    const {person} = this.plan
    if (!person) {
      return this._('No person linked')
    }
    return html`
      <grampsjs-object-link object-type="person" gramps-id="${person.gramps_id}"
        >${person.name || person.gramps_id}</grampsjs-object-link
      >
      <span class="small">${person.gramps_id}</span>
    `
  }

  _renderDetails() {
    const {plan} = this
    const names = successorNames(plan)
    return html`
      <dl>
        <dt>${this._('Linked person')}</dt>
        <dd>${this._renderPerson()}</dd>
        <dt>${this._('Successors')}</dt>
        <dd>
          ${names.length
            ? html`<ol>
                ${names.map(name => html`<li>${name}</li>`)}
              </ol>`
            : this._('None')}
        </dd>
        <dt>${this._('Required confirmations')}</dt>
        <dd>${plan.required_confirmations}</dd>
        <dt>${this._('Grace period (days)')}</dt>
        <dd>${plan.grace_days}</dd>
        ${canCancelPlan(plan)
          ? html`
              <dt>${this._('Confirmations')}</dt>
              <dd>${this._renderConfirmations()}</dd>
            `
          : ''}
      </dl>
    `
  }

  _renderCompactDetails() {
    const {plan} = this
    const names = successorNames(plan)
    return html`
      <p>
        ${this._('Linked person')}: ${this._renderPerson()}<br />
        ${this._('Successors')}:
        ${names.length ? names.join(', ') : this._('None')}
        ${canCancelPlan(plan)
          ? html`<br />${this._('Confirmations')}:
              ${plan.confirmations?.length ?? 0} /
              ${plan.required_confirmations}`
          : ''}
      </p>
    `
  }

  _renderConfirmations() {
    const {plan} = this
    const confirmations = plan.confirmations ?? []
    return html`
      ${confirmations.length} / ${plan.required_confirmations}
      ${confirmations.length
        ? html`
            <ul>
              ${confirmations.map(
                confirmation => html`
                  <li>
                    ${userDisplayName(confirmation.user)}
                    <span class="small">
                      ${formatTimestamp(confirmation.created_at, this._lang)}
                    </span>
                  </li>
                `
              )}
            </ul>
          `
        : ''}
    `
  }

  _renderHistory() {
    const {plan} = this
    if (plan.state === 'executed') {
      return html`
        <p>
          ${this._('Taken over by %s', userLabel(plan.executed_successor))}
          <span class="small"
            >${formatTimestamp(plan.executed_at, this._lang)}</span
          >
        </p>
      `
    }
    if (canCancelPlan(plan)) {
      return html`
        <p class="small">
          ${this._(
            'Death recorded on %s',
            formatTimestamp(plan.death_recorded_at, this._lang)
          )}
        </p>
      `
    }
    if (plan.vetoed_at) {
      return html`
        <p class="small">
          ${this._(
            'Last cancelled on %s',
            formatTimestamp(plan.vetoed_at, this._lang)
          )}
        </p>
      `
    }
    return ''
  }

  _renderActions() {
    const {plan} = this
    const editable = isOpenPlan(plan) && (plan.is_own || this.canManage)
    const actions = []
    if (plan.is_own && canCancelPlan(plan)) {
      actions.push(html`
        <md-filled-button
          ?disabled="${this.busy}"
          @click="${() => this._fire('succession:cancel')}"
        >
          <grampsjs-icon
            slot="icon"
            path="${mdiHeartPulse}"
            color="var(--md-filled-button-label-text-color, var(--mdc-theme-on-primary))"
          ></grampsjs-icon>
          ${this._('I am alive - cancel')}
        </md-filled-button>
      `)
    }
    if (plan.can_confirm) {
      actions.push(html`
        <md-filled-button
          ?disabled="${this.busy}"
          @click="${() => this._fire('succession:confirm')}"
        >
          <grampsjs-icon
            slot="icon"
            path="${mdiAccountCheck}"
            color="var(--md-filled-button-label-text-color, var(--mdc-theme-on-primary))"
          ></grampsjs-icon>
          ${this._('Confirm recorded death')}
        </md-filled-button>
      `)
    }
    if (!plan.is_own && this.canManage && canCancelPlan(plan)) {
      actions.push(html`
        <md-outlined-button
          ?disabled="${this.busy}"
          @click="${() => this._fire('succession:cancel')}"
        >
          ${this._('Cancel')}
        </md-outlined-button>
      `)
    }
    if (editable) {
      actions.push(html`
        <md-outlined-button
          ?disabled="${this.busy}"
          @click="${() => this._fire('succession:edit')}"
        >
          ${this._('Edit')}
        </md-outlined-button>
      `)
    }
    if (editable || this.canManage) {
      actions.push(html`
        <md-outlined-button
          ?disabled="${this.busy}"
          @click="${() => this._fire('succession:delete')}"
        >
          ${this._('Delete')}
        </md-outlined-button>
      `)
    }
    return actions
  }

  _fire(name) {
    fireEvent(this, name, {plan: this.plan})
  }
}

window.customElements.define('grampsjs-succession-plan', GrampsjsSuccessionPlan)
