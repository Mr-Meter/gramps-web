/*
Succession plans at /settings/succession
*/

import {html, css} from 'lit'

import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/dialog/dialog.js'

import {mdiAccountPlus, mdiPlay} from '@mdi/js'

import {GrampsjsView} from './GrampsjsView.js'
import '../components/GrampsjsIcon.js'
import '../components/GrampsjsSuccessionForm.js'
import '../components/GrampsjsSuccessionPlan.js'
import {fireEvent} from '../util.js'
import {
  candidatesUrl,
  countChangedPlans,
  excludeUser,
  hasOpenOwnPlan,
  splitPlans,
  userLabel,
} from '../util/succession.js'

export class GrampsjsViewSuccession extends GrampsjsView {
  static get styles() {
    return [
      super.styles,
      css`
        h3 {
          margin-bottom: 0.5em;
        }

        .toolbar {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 1em 0;
        }

        .empty {
          color: var(--grampsjs-body-font-color-60);
        }
      `,
    ]
  }

  static get properties() {
    return {
      _plans: {type: Array},
      _candidates: {type: Array},
      _ownUserName: {type: String},
      _canPlan: {type: Boolean},
      _loaded: {type: Boolean},
      _busy: {type: Boolean},
      _editingPlanId: {type: Number},
      _creatingForOther: {type: Boolean},
      _pendingAction: {type: Object},
    }
  }

  constructor() {
    super()
    this._plans = []
    this._candidates = []
    this._ownUserName = ''
    this._canPlan = false
    this._loaded = false
    this._busy = false
    this._editingPlanId = null
    this._creatingForOther = false
    this._pendingAction = null
  }

  renderContent() {
    const {canEdit, canManageUsers} = this.appState.permissions
    if (!this._loaded) {
      return ''
    }
    if (!canEdit && this._plans.length === 0) {
      return html`
        <p style="margin-top: 2.5em;">
          ${this._('There are no succession plans that concern you.')}
        </p>
      `
    }
    const {own, others} = splitPlans(this._plans)
    return html`
      <p style="margin-top: 2.5em;">
        ${this._(
          'A succession plan hands your role and your branches to a successor once your death is recorded in the family tree, confirmed by other editors and a grace period has passed. Logging in with your password cancels a running plan.'
        )}
      </p>

      <h3>${this._('Your succession plan')}</h3>
      ${this._renderOwnSection(own)}
      ${others.length || canManageUsers
        ? html`
            <h3>${this._('Other plans')}</h3>
            ${this._renderOthersSection(others)}
          `
        : ''}
      ${this._pendingAction ? this._renderConfirmDialog() : ''}
    `
  }

  _renderOwnSection(own) {
    const showForm = this._canPlan && !hasOpenOwnPlan(this._plans)
    if (own.length === 0 && !showForm) {
      return html`<p class="empty">${this._('None')}.</p>`
    }
    return html`
      ${own.map(plan => this._renderPlan(plan, false))}
      ${showForm ? this._renderForm(null, false) : ''}
    `
  }

  _renderOthersSection(others) {
    const {canManageUsers} = this.appState.permissions
    return html`
      ${canManageUsers
        ? html`
            <div class="toolbar">
              <md-outlined-button
                ?disabled="${this._busy}"
                @click="${this._runCheck}"
              >
                <grampsjs-icon
                  slot="icon"
                  path="${mdiPlay}"
                  color="var(--mdc-theme-primary)"
                ></grampsjs-icon>
                ${this._('Run check now')}
              </md-outlined-button>
              <md-outlined-button
                ?disabled="${this._busy ||
                this._creatingForOther ||
                !this._canPlan}"
                @click="${() => {
                  this._creatingForOther = true
                }}"
              >
                <grampsjs-icon
                  slot="icon"
                  path="${mdiAccountPlus}"
                  color="var(--mdc-theme-primary)"
                ></grampsjs-icon>
                ${this._('Create a plan for another user')}
              </md-outlined-button>
            </div>
          `
        : ''}
      ${this._creatingForOther ? this._renderForm(null, true) : ''}
      ${others.length
        ? others.map(plan => this._renderPlan(plan, true))
        : html`<p class="empty">${this._('None')}.</p>`}
    `
  }

  _renderPlan(plan, compact) {
    if (plan.id === this._editingPlanId) {
      return this._renderForm(plan, !plan.is_own)
    }
    return html`
      <grampsjs-succession-plan
        .plan="${plan}"
        ?compact="${compact}"
        ?canManage="${this.appState.permissions.canManageUsers}"
        ?busy="${this._busy}"
        .appState="${this.appState}"
        @succession:edit="${this._handleEdit}"
        @succession:delete="${e =>
          this._askConfirmation('delete', e.detail.plan)}"
        @succession:confirm="${e =>
          this._askConfirmation('confirm', e.detail.plan)}"
        @succession:cancel="${this._handleCancelPlan}"
      ></grampsjs-succession-plan>
    `
  }

  // The candidates are the successors of the own plan and, for a manager, the
  // users to create a plan for: neither must be the caller, so the caller is
  // left out here as well in case the API answered from stale data.
  _renderForm(plan, forOtherUser) {
    return html`
      <grampsjs-succession-form
        .plan="${plan}"
        .candidates="${excludeUser(this._candidates, this._ownUserName)}"
        ?forOtherUser="${forOtherUser}"
        ?saving="${this._busy}"
        .appState="${this.appState}"
        @succession:save="${this._handleSave}"
        @succession:cancel="${this._closeForm}"
      ></grampsjs-succession-form>
    `
  }

  _renderConfirmDialog() {
    const {action, plan} = this._pendingAction
    const isDelete = action === 'delete'
    return html`
      <md-dialog open @cancel="${this._closeDialog}">
        <span slot="headline">
          ${isDelete
            ? this._('Delete this succession plan?')
            : this._('Confirm recorded death')}
        </span>
        <div slot="content">
          <p>
            ${isDelete
              ? this._('Plan of %s', userLabel(plan.user))
              : this._(
                  'You confirm that the death of %s recorded in the family tree is correct. After enough confirmations and the grace period, the role and branches are handed over to the successor.',
                  userLabel(plan.user)
                )}
          </p>
        </div>
        <div slot="actions">
          <md-text-button @click="${this._closeDialog}">
            ${this._('Cancel')}
          </md-text-button>
          <md-text-button @click="${this._runPendingAction}">
            ${isDelete ? this._('Delete') : this._('Confirm')}
          </md-text-button>
        </div>
      </md-dialog>
    `
  }

  update(changed) {
    super.update(changed)
    if (changed.has('active') && this.active) {
      this._fetchAll()
    }
  }

  async _fetchAll() {
    await Promise.all([
      this._fetchPlans(),
      this._fetchCandidates(),
      this._fetchOwnUserName(),
    ])
  }

  async _fetchPlans() {
    this.loading = true
    const data = await this.appState.apiGet('/api/succession/')
    this.loading = false
    if ('error' in data) {
      this.error = true
      this._errorMessage = data.error
      return
    }
    this.error = false
    this._plans = data.data
    this._loaded = true
  }

  async _fetchCandidates() {
    if (!this.appState.permissions.canEdit) {
      this._canPlan = false
      this._candidates = []
      return
    }
    const data = await this.appState.apiGet(candidatesUrl())
    if ('error' in data) {
      this._canPlan = false
      this._candidates = []
      // A 403 only means this user may not plan; anything else is reported.
      if (data.errorDetail?.status !== 403) {
        fireEvent(this, 'grampsjs:error', {message: data.error})
      }
      return
    }
    this._canPlan = true
    this._candidates = data.data
  }

  // The token only carries the user ID, so the username that the forms must
  // never offer comes from the profile. Only managers pick users; a failure
  // merely leaves the forms relying on the API, which leaves the caller out.
  async _fetchOwnUserName() {
    if (!this.appState.permissions.canManageUsers) {
      this._ownUserName = ''
      return
    }
    const data = await this.appState.apiGet('/api/users/-/')
    this._ownUserName = 'error' in data ? '' : data.data?.name ?? ''
  }

  // Runs a mutation, reports the outcome and reloads the plans on success.
  async _mutate(request, successMessage) {
    this._busy = true
    const data = await request
    this._busy = false
    if ('error' in data) {
      fireEvent(this, 'grampsjs:error', {message: data.error})
      return null
    }
    if (successMessage) {
      fireEvent(this, 'grampsjs:notification', {message: successMessage})
    }
    await this._fetchPlans()
    return data.data ?? {}
  }

  _handleEdit(e) {
    this._editingPlanId = e.detail.plan.id
  }

  _closeForm() {
    this._editingPlanId = null
    this._creatingForOther = false
  }

  async _handleSave(e) {
    const {plan, payload} = e.detail
    const request = plan
      ? this.appState.apiPut(`/api/succession/${plan.id}/`, payload)
      : this.appState.apiPost('/api/succession/', payload)
    const data = await this._mutate(request, this._('Succession plan saved'))
    if (data) {
      this._closeForm()
    }
  }

  _handleCancelPlan(e) {
    this._mutate(
      this.appState.apiPost(`/api/succession/${e.detail.plan.id}/cancel/`, {}),
      this._('The succession plan is active again')
    )
  }

  _askConfirmation(action, plan) {
    this._pendingAction = {action, plan}
  }

  _closeDialog() {
    this._pendingAction = null
  }

  async _runPendingAction() {
    const {action, plan} = this._pendingAction
    this._pendingAction = null
    if (action === 'delete') {
      const data = await this._mutate(
        this.appState.apiDelete(`/api/succession/${plan.id}/`),
        this._('Succession plan deleted')
      )
      if (data && this._editingPlanId === plan.id) {
        this._editingPlanId = null
      }
    } else if (action === 'confirm') {
      this._mutate(
        this.appState.apiPost(`/api/succession/${plan.id}/confirm/`, {}),
        this._('Recorded death confirmed')
      )
    }
  }

  async _runCheck() {
    const data = await this._mutate(
      this.appState.apiPost('/api/succession/check/', {})
    )
    if (data) {
      fireEvent(this, 'grampsjs:notification', {
        message: this._(
          'Check completed. Plans changed: %s',
          countChangedPlans(data)
        ),
      })
    }
  }
}

window.customElements.define('grampsjs-view-succession', GrampsjsViewSuccession)
