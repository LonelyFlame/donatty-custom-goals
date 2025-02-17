class SSEService {
  _RECONNECT_INTERVAL = 10 * 60 * 1000;
  _MESSAGE_TYPES = {
    DATA: 'DATA',
    PING: 'PING',
    REFRESH: 'REFRESH',
    DELETE: 'DELETE',
  };

  /**
   * @type {string}
   */
  _ref

  /**
   * @type {ConnectionService} connectionService
   */
  _connectionService

  /**
   * @type {number | null} timeout ID
   */
  _reconnectionTimeout = null;

  /**
   * @type {EventSource}
   */
  _eventSource = null;

  /**
   * @param {string} ref
   * @param {ConnectionService} connectionService
   */
  constructor(ref, connectionService) {
    this._connectionService = connectionService;
    this._ref = ref;
  }

  /**
   * @returns {Promise<void>}
   */
  async _connectToSSE() {
    if (this._eventSource) {
      this._eventSource.close();
    }

    const eventSource = await this._connectionService.getSSEConnection();

    eventSource.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    eventSource.onerror = (e) => {
      console.error('SSE error', e);
      console.error('reconnecting...');

      this._eventSource.close();

      this._clearReconnectTimeout();
      setTimeout(() => this._connectToSSE(), 5000);
    };

    this._eventSource = eventSource;

    this._scheduleReconnect();
  }

  _scheduleReconnect() {
    this._clearReconnectTimeout();

    this._reconnectionTimeout = setTimeout(() => {
      console.info('Reconnecting SSE after 10 minutes...');

      this._connectToSSE();
    }, this._RECONNECT_INTERVAL);
  }

  _clearReconnectTimeout() {
    if (!this._reconnectionTimeout) {
      return;
    }

    clearTimeout(this._reconnectionTimeout);
    this._reconnectionTimeout = null;
  }

  /**
   *
   * @param {string} message
   * @returns {{goal: undefined, raised: undefined, type: 'PING'}}
   * @returns {{goal: number?, raised: number, type: 'DATA'}}
   */
  _prepareMessage(message) {
    const { action, data } = JSON.parse(message);

    let type;
    let goal;
    let raised;

    switch (action) {
      case this._MESSAGE_TYPES.REFRESH: {
        type = this._MESSAGE_TYPES.DATA;
        raised = data.props.data.goalCollected;
        goal = data.props.data.goal;

        break;
      }
      case this._MESSAGE_TYPES.DATA: {
        type = this._MESSAGE_TYPES.DATA;
        raised = data.raised;

        break;
      }
      default: {
        type = this._MESSAGE_TYPES.PING;
      }
    }

    return { type, goal, raised };
  }

  /**
   * @param {string} message
   */
  handleMessage(message) {
    document.dispatchEvent(new CustomEvent(
      `${this._ref}_sse_message`,
      {
        detail: { message },
      },
    ));

    const { type, goal, raised } = this._prepareMessage(message);

    if (type === this._MESSAGE_TYPES.DATA) {
      document.dispatchEvent(new CustomEvent(
        `${this._ref}_sse_data`,
        {
          detail: { raised, goal },
        },
      ));
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async start() {
    return this._connectToSSE();
  }
}

export default SSEService;
