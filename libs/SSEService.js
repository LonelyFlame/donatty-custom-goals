class SSEService {
  #RECONNECT_INTERVAL = 10 * 60 * 1000;
  #MESSAGE_TYPES = {
    DATA: 'DATA',
    PING: 'PING',
    REFRESH: 'REFRESH',
    DELETE: 'DELETE',
  };

  /**
   * @type {string}
   */
  #ref

  /**
   * @type {ConnectionService} connectionService
   */
  #connectionService

  /**
   * @type {number | null} timeout ID
   */
  #reconnectionTimeout = null;

  /**
   * @type {EventSource}
   */
  #eventSource = null;

  /**
   * @param {string} ref
   * @param {ConnectionService} connectionService
   */
  constructor(ref, connectionService) {
    this.#connectionService = connectionService;
    this.#ref = ref;
  }

  /**
   * @returns {Promise<void>}
   */
  async #connectToSSE() {
    if (this.#eventSource) {
      this.#eventSource.close();
    }

    const eventSource = await this.#connectionService.getSSEConnection();

    eventSource.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    eventSource.onerror = (e) => {
      console.error('SSE error', e);
      console.error('reconnecting...');

      this.#eventSource.close();

      this.#clearReconnectTimeout();
      setTimeout(() => this.#connectToSSE(), 5000);
    };

    this.#eventSource = eventSource;

    this.#scheduleReconnect();
  }

  #scheduleReconnect() {
    this.#clearReconnectTimeout();

    this.#reconnectionTimeout = setTimeout(() => {
      console.info('Reconnecting SSE after 10 minutes...');

      this.#connectToSSE();
    }, this.#RECONNECT_INTERVAL);
  }

  #clearReconnectTimeout() {
    if (!this.#reconnectionTimeout) {
      return;
    }

    clearTimeout(this.#reconnectionTimeout);
    this.#reconnectionTimeout = null;
  }

  /**
   *
   * @param {string} message
   * @returns {{goal: undefined, raised: undefined, type: 'PING'}}
   * @returns {{goal: number?, raised: number, type: 'DATA'}}
   */
  #prepareMessage(message) {
    const { action, data } = JSON.parse(message);

    let type;
    let goal;
    let raised;

    switch (action) {
      case this.#MESSAGE_TYPES.REFRESH: {
        type = this.#MESSAGE_TYPES.DATA;
        raised = data.props.data.goalCollected;
        goal = data.props.data.goal;

        break;
      }
      case this.#MESSAGE_TYPES.DATA: {
        type = this.#MESSAGE_TYPES.DATA;
        raised = data.raised;

        break;
      }
      default: {
        type = this.#MESSAGE_TYPES.PING;
      }
    }

    return { type, goal, raised };
  }

  /**
   * @param {string} message
   */
  handleMessage(message) {
    document.dispatchEvent(new CustomEvent(
      `${this.#ref}_sse_message`,
      {
        detail: { message },
      },
    ));

    const { type, goal, raised } = this.#prepareMessage(message);

    if (type === this.#MESSAGE_TYPES.DATA) {
      document.dispatchEvent(new CustomEvent(
        `${this.#ref}_sse_data`,
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
    return this.#connectToSSE();
  }
}

export default SSEService;
