/*
Form to create or edit a succession plan
*/

import {html, css, LitElement} from 'lit'

import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/iconbutton/icon-button.js'
import '@material/web/list/list.js'
import '@material/web/list/list-item.js'
import '@material/web/select/filled-select.js'
import '@material/web/select/select-option.js'
import '@material/web/textfield/filled-text-field.js'

import {mdiArrowDown, mdiArrowUp, mdiDelete} from '@mdi/js'

import {sharedStyles, iconButtonColorStyles} from '../SharedStyles.js'
import {GrampsjsAppStateMixin} from '../mixins/GrampsjsAppStateMixin.js'
import {fireEvent, personDisplayName} from '../util.js'
import './GrampsjsFormSelectObject.js'
import './GrampsjsIcon.js'
import {
  MAX_GRACE_DAYS,
  MAX_REQUIRED_CONFIRMATIONS,
  addSuccessor,
  buildPlanPayload,
  candidatesUrl,
  formErrors,
  formFromPlan,
  isFormValid,
  moveItem,
  personLabel,
  planUserName,
  remainingCandidates,
  removeAt,
  userLabel,
  userLookup,
} from '../util/succession.js'

class GrampsjsSuccessionForm extends GrampsjsAppStateMixin(LitElement) {
  static get styles() {
    return [
      sharedStyles,
      iconButtonColorStyles,
      css`
        :host {
          display: block;
          max-width: 720px;
        }

        h4 {
          margin: 1.5em 0 0.5em;
        }

        md-filled-select,
        md-filled-text-field {
          width: 100%;
        }

        .person {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px 16px;
        }

        md-list {
          padding: 0;
          margin-bottom: 12px;
        }

        md-icon-button {
          --grampsjs-icon-button-color: var(--grampsjs-body-font-color-40);
          --grampsjs-icon-button-disabled-color: var(
            --grampsjs-body-font-color-15
          );
          --grampsjs-icon-button-disabled-opacity: 1;
        }

        .row-actions {
          display: flex;
        }

        .fields {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 12px 24px;
          align-items: start;
          margin-top: 1.5em;
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 1.5em;
        }
      `,
    ]
  }

  static get properties() {
    return {
      plan: {type: Object},
      candidates: {type: Array},
      forOtherUser: {type: Boolean},
      saving: {type: Boolean},
      _form: {type: Object, state: true},
      _otherCandidates: {type: Array, state: true},
      _loadingCandidates: {type: Boolean, state: true},
    }
  }

  constructor() {
    super()
    this.plan = null
    this.candidates = []
    this.forOtherUser = false
    this.saving = false
    this._form = formFromPlan(null)
    // Successors of another user's plan come from a list that leaves out that
    // user rather than the manager; it is fetched once per target user.
    this._otherCandidates = []
    this._otherCandidatesFor = ''
    this._loadingCandidates = false
  }

  willUpdate(changed) {
    if (changed.has('plan')) {
      this._form = formFromPlan(this.plan)
    }
    const target = this.forOtherUser ? planUserName(this.plan, this._form) : ''
    if (target !== this._otherCandidatesFor) {
      this._fetchOtherCandidates(target)
    }
  }

  // Only a manager creating a plan for somebody else picks the user.
  get _needsUser() {
    return this.forOtherUser && !this.plan
  }

  get _heading() {
    if (!this.plan) {
      return this._('New succession plan')
    }
    return this.plan.is_own
      ? this._('Edit succession plan')
      : this._('Plan of %s', userLabel(this.plan.user))
  }

  render() {
    const errors = formErrors(this._form)
    return html`
      <h4>${this._heading}</h4>
      ${this._needsUser ? this._renderUserSelect() : ''}
      <h4>${this._('Linked person')}</h4>
      ${this._renderPerson()}
      <h4>${this._('Successors')}</h4>
      ${this._renderSuccessors()}
      ${this._form.successors.length === 0
        ? html`<p class="alert warn">
            ${this._(
              'No successor has been chosen yet, so there is nobody to hand the role to.'
            )}
          </p>`
        : ''}
      <div class="fields">
        <md-filled-text-field
          type="number"
          min="0"
          max="${MAX_REQUIRED_CONFIRMATIONS}"
          label="${this._('Required confirmations')}"
          supporting-text="${this._(
            'How many other editors must confirm the recorded death'
          )}"
          error-text="${this._(
            'Enter a whole number between %s and %s',
            0,
            MAX_REQUIRED_CONFIRMATIONS
          )}"
          ?error="${errors.requiredConfirmations}"
          .value="${this._form.requiredConfirmations}"
          @input="${e =>
            this._setField('requiredConfirmations', e.target.value)}"
        ></md-filled-text-field>
        <md-filled-text-field
          type="number"
          min="0"
          max="${MAX_GRACE_DAYS}"
          label="${this._('Grace period (days)')}"
          supporting-text="${this._(
            'Days to wait after the last confirmation before the handover'
          )}"
          error-text="${this._(
            'Enter a whole number between %s and %s',
            0,
            MAX_GRACE_DAYS
          )}"
          ?error="${errors.graceDays}"
          .value="${this._form.graceDays}"
          @input="${e => this._setField('graceDays', e.target.value)}"
        ></md-filled-text-field>
      </div>
      <div class="actions">
        <md-filled-button
          ?disabled="${this.saving ||
          !isFormValid(this._form, {needsUser: this._needsUser})}"
          @click="${this._handleSave}"
        >
          ${this._('_Save')}
        </md-filled-button>
        <md-outlined-button
          ?disabled="${this.saving}"
          @click="${() => fireEvent(this, 'succession:cancel')}"
        >
          ${this._('Cancel')}
        </md-outlined-button>
      </div>
    `
  }

  _renderUserSelect() {
    return html`
      <md-filled-select
        label="${this._('User')}"
        @change="${this._handleUserChange}"
      >
        ${this.candidates.map(
          user => html`
            <md-select-option
              value="${user.name}"
              ?selected="${user.name === this._form.user}"
            >
              <div slot="headline">${userLabel(user)}</div>
            </md-select-option>
          `
        )}
      </md-filled-select>
    `
  }

  _renderPerson() {
    const {personHandle} = this._form
    return html`
      <div class="person">
        <span>${this._form.personLabel || this._('No person linked')}</span>
        <grampsjs-form-select-object
          objectType="person"
          .objects="${personHandle ? [{handle: personHandle}] : []}"
          .appState="${this.appState}"
          @select-object:changed="${this._handlePersonSelected}"
        ></grampsjs-form-select-object>
        ${personHandle
          ? html`
              <md-outlined-button @click="${this._clearPerson}">
                ${this._('Clear')}
              </md-outlined-button>
            `
          : ''}
      </div>
    `
  }

  // Users the successor picker offers before the chosen ones are removed.
  get _successorPool() {
    return this.forOtherUser ? this._otherCandidates : this.candidates
  }

  _renderSuccessors() {
    const {successors} = this._form
    // Only the other list holds the manager, who may succeed another user.
    const users = userLookup(
      [...this.candidates, ...this._otherCandidates],
      this.plan
    )
    const remaining = remainingCandidates(
      this._successorPool,
      successors,
      planUserName(this.plan, this._form)
    )
    return html`
      ${successors.length
        ? html`
            <md-list>
              ${successors.map(
                (name, index) => html`
                  <md-list-item type="text" noninteractive>
                    <div slot="headline">
                      ${index + 1}. ${userLabel(users[name] ?? {name})}
                    </div>
                    <div slot="end" class="row-actions">
                      <md-icon-button
                        aria-label="${this._('Move Up')}"
                        ?disabled="${index === 0}"
                        @click="${() => this._moveSuccessor(index, index - 1)}"
                      >
                        <grampsjs-icon
                          path="${mdiArrowUp}"
                          color="currentColor"
                        ></grampsjs-icon>
                      </md-icon-button>
                      <md-icon-button
                        aria-label="${this._('Move Down')}"
                        ?disabled="${index === successors.length - 1}"
                        @click="${() => this._moveSuccessor(index, index + 1)}"
                      >
                        <grampsjs-icon
                          path="${mdiArrowDown}"
                          color="currentColor"
                        ></grampsjs-icon>
                      </md-icon-button>
                      <md-icon-button
                        aria-label="${this._('Remove')}"
                        @click="${() => this._removeSuccessor(index)}"
                      >
                        <grampsjs-icon
                          path="${mdiDelete}"
                          color="currentColor"
                        ></grampsjs-icon>
                      </md-icon-button>
                    </div>
                  </md-list-item>
                `
              )}
            </md-list>
          `
        : ''}
      ${remaining.length || this._loadingCandidates
        ? html`
            <md-filled-select
              label="${this._('Add successor')}"
              ?disabled="${this._loadingCandidates}"
              @change="${this._handleAddSuccessor}"
            >
              ${remaining.map(
                user => html`
                  <md-select-option value="${user.name}">
                    <div slot="headline">${userLabel(user)}</div>
                  </md-select-option>
                `
              )}
            </md-filled-select>
          `
        : ''}
    `
  }

  async _fetchOtherCandidates(user) {
    this._otherCandidatesFor = user
    if (!user) {
      this._otherCandidates = []
      this._loadingCandidates = false
      return
    }
    // The previous list stays until the new one arrives, so that the labels
    // of chosen successors do not flicker; the picker is disabled meanwhile.
    this._loadingCandidates = true
    const data = await this.appState.apiGet(candidatesUrl(user))
    if (user !== this._otherCandidatesFor) {
      // The target changed meanwhile; the newer request takes over.
      return
    }
    this._loadingCandidates = false
    if ('error' in data) {
      this._otherCandidates = []
      fireEvent(this, 'grampsjs:error', {message: data.error})
      return
    }
    this._otherCandidates = data.data
  }

  _setField(key, value) {
    this._form = {...this._form, [key]: value}
  }

  _handleUserChange(e) {
    const user = e.target.value
    this._form = {
      ...this._form,
      user,
      successors: this._form.successors.filter(name => name !== user),
    }
  }

  _handlePersonSelected(e) {
    const obj = e.detail.objects?.[0]
    if (!obj) {
      return
    }
    const person = obj.object ?? {}
    this._form = {
      ...this._form,
      personHandle: obj.handle ?? person.handle,
      personLabel: personLabel({
        name: personDisplayName(person),
        gramps_id: person.gramps_id,
      }),
    }
  }

  _clearPerson() {
    this._form = {...this._form, personHandle: null, personLabel: ''}
  }

  _handleAddSuccessor(e) {
    const select = e.target
    this._form = {
      ...this._form,
      successors: addSuccessor(this._form.successors, select.value),
    }
    // The chosen option leaves the list; reset clears the displayed value.
    select.reset()
  }

  _moveSuccessor(from, to) {
    this._form = {
      ...this._form,
      successors: moveItem(this._form.successors, from, to),
    }
  }

  _removeSuccessor(index) {
    this._form = {
      ...this._form,
      successors: removeAt(this._form.successors, index),
    }
  }

  _handleSave() {
    if (!isFormValid(this._form, {needsUser: this._needsUser})) {
      return
    }
    fireEvent(this, 'succession:save', {
      plan: this.plan,
      payload: buildPlanPayload(this._form, {withUser: this._needsUser}),
    })
  }
}

window.customElements.define('grampsjs-succession-form', GrampsjsSuccessionForm)
