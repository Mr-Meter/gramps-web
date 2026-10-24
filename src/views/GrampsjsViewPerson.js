import {html} from 'lit'

import {GrampsjsViewObject} from './GrampsjsViewObject.js'
import {fireEvent} from '../util.js'
import '../components/GrampsjsPerson.js'

export class GrampsjsViewPerson extends GrampsjsViewObject {
  static get properties() {
    return {
      homePersonDetails: {type: Object},
      _timelineData: {type: Array},
      _timelineLoading: {type: Boolean},
    }
  }

  constructor() {
    super()
    this.homePersonDetails = {}
    this._className = 'person'
    this._timelineData = []
    this._timelineLoading = false
    this._boundHandleTimelineNeeded = this._handleTimelineNeeded.bind(this)
  }

  connectedCallback() {
    super.connectedCallback()
    this.addEventListener(
      'person:timeline-needed',
      this._boundHandleTimelineNeeded
    )
  }

  disconnectedCallback() {
    this.removeEventListener(
      'person:timeline-needed',
      this._boundHandleTimelineNeeded
    )
    super.disconnectedCallback()
  }

  _clearData() {
    super._clearData()
    this._timelineData = []
    this._timelineLoading = false
    this._timelineUrl = '' // a late response for the previous person is dropped
  }

  _handleLangChange(lang) {
    super._handleLangChange(lang)
    if (this.active && this._timelineData.length) {
      this._fetchTimeline()
    }
  }

  _handleTimelineNeeded() {
    if (!this._timelineData.length && !this._timelineLoading) {
      this._fetchTimeline()
    }
  }

  _fetchTimeline() {
    const handle = this._data?.handle
    if (!handle) return
    this._timelineLoading = true
    const url = `/api/people/${handle}/timeline?locale=${
      this.appState.i18n.lang || 'en'
    }&precision=1`
    this._timelineUrl = url
    this.appState.apiGet(url).then(result => {
      if (url !== this._timelineUrl) {
        return // superseded by a newer request
      }
      this._timelineLoading = false
      if ('data' in result) {
        this._timelineData = result.data
      } else if ('error' in result) {
        fireEvent(this, 'grampsjs:error', {message: result.error})
      }
    })
  }

  getUrl() {
    return `/api/people/?gramps_id=${this.grampsId}&locale=${
      this.appState.i18n.lang || 'en'
    }&profile=all&backlinks=true&extend=all&precision=1`
  }

  renderElement() {
    return html`
      <grampsjs-person
        .data=${this._data}
        .appState="${this.appState}"
        .homePersonDetails=${this.homePersonDetails}
        .timelineData=${this._timelineData}
        ?edit="${this.edit}"
        ?canEdit="${this.canEdit}"
      ></grampsjs-person>
    `
  }
}

window.customElements.define('grampsjs-view-person', GrampsjsViewPerson)
