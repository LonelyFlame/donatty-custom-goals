class SSEClient {
  #RECONNECT_INTERVAL = 10 * 60 * 1000;
  #MESSAGE_TYPES = {
    DATA: 'DATA',
    PING: 'PING',
    REFRESH: 'REFRESH',
    DELETE: 'DELETE',
  };

  /**
   *
   * @type {string}
   */
  #sseEndpoint = '';
  /**
   *
   * @type {number}
   */
  #zoneOffset = this.#getTimeZoneOffset();


  /**
   *
   * @type {number | null} timeout ID
   */
  #reconnectionTimeout = null;

  /**
   *
   * @type {AuthClient}
   */
  #authClient = null;

  /**
   *
   * @type {EventSource}
   */
  #eventSource = null;

  constructor(authClient, refToken) {
    this.#authClient = authClient;

    this.#sseEndpoint = `${fmtApiUri(refToken)}/widgets/${refToken}/sse`;
  }

  /**
   *
   * @returns {number}
   */
  #getTimeZoneOffset() {
    return (new Date).getTimezoneOffset()
  }

  #connectToSSE() {
    if (this.#eventSource) {
      this.#eventSource.close();
    }

    const jwt = this.#authClient.jwt;

    const eventSource = new EventSource(
      `${this.#sseEndpoint}?jwt=${jwt}&zoneOffset=${this.#zoneOffset}`
    );

    eventSource.onmessage = (event) => {
      this.onMessage(event.data);
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

      this.#connectToSSE(this.#authClient.jwt);
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
   *
   * @param {string} message
   */
  onMessage(message) {
    const { type, goal, raised } = this.#prepareMessage(message);

    if (type !== this.#MESSAGE_TYPES.DATA) {
      return;
    }

    this.onData(raised, goal);
  }

  /**
   *
   * @param {number} raised
   * @param {number?} goal
   */
  onData(raised, goal) {
    console.log('New data:', { raised, goal });
  }

  async start() {
    if (!this.#authClient) {
      console.error('Auth is missing in the URL');
      return;
    }

    this.#connectToSSE();
  }
};

export default SSEClient;
