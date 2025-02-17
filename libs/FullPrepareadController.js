class ConnectionService {
  /**
   * @type {string}
   */
  #refToken = '';
  /**
   * @type {string}
   */
  #authToken = '';
  /**
   * @type {string}
   */
  #jwtToken = '';
  /**
   * @type {string}
   */
  #endpoint = 'https://api.donatty.com';

  /**
   * @type AuthService
   */
  #authService;

  /**
   * @param {string} authToken
   * @param {string} refToken
   */
  constructor(authToken, refToken) {
    this.#endpoint = this.#fmtApiUri(refToken);
    this.#authToken = authToken;
    this.#refToken = refToken;

    this.#authService = new AuthService(this.authEndpoint);
  }

  /**
   * @type {string}
   */
  get authEndpoint() {
    return this.#endpoint + `/auth/tokens`;
  }
  /**
   * @type {string}
   */
  get widgetsEndpoint() {
    return this.#endpoint + `/widgets/${this.#refToken}`;
  }
  /**
   * @type {string}
   */
  get sseEndpoint() {
    return this.widgetsEndpoint + `/sse`;
  }
  /**
   * @returns {number}
   */
  get #zoneOffset() {
    return (new Date).getTimezoneOffset()
  }

  /**
   * @param {string} ref
   * @returns {string}
   */
  #fmtApiUri = (ref) => {
    const baseUri = "https://api.donatty.com";
    const G = 1;
    const q = 30;

    const n = ref.length;
    const r = n - 2;
    const i = ref.slice(r, n);
    const o = parseInt(i, 16);
    const s = G + o % (q - G);
    const a = new Intl.NumberFormat("en-IN",{ minimumIntegerDigits: 3 }).format(s);

    return baseUri.replace("://api.", `://api-${a}.`);
  }

  async #getJWT() {
    if (!this.#jwtToken) {
      this.#jwtToken = await this.#authService.auth(this.#authToken);
    }

    return this.#jwtToken;
  }

  async getSSEConnection() {
    const jwt = await this.#getJWT();

    return new EventSource(`${this.sseEndpoint}?jwt=${jwt}&zoneOffset=${this.#zoneOffset}`);
  }

  /**
   * @returns {Promise<{goal:number, raised: number}>}
   */
  async getData() {
    try {
      const jwt = await this.#getJWT();
      const response = await fetch(this.widgetsEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
      });

      const { response: { props: { data: { goal, goalCollected } } } } = await response.json();

      return { goal, raised: goalCollected };
    } catch (error) {
      console.error('Failed to fetch initial data:', error);

      throw error;
    }
  }
}

class AuthService {
  /**
   * @type {string}
   */
  #endpoint = '';

  /**
   * @param {string} endpoint
   */
  constructor(endpoint) {
    this.#endpoint = endpoint;
  };

  /**
   * @param token
   * @returns {Promise<string>}
   */
  async auth(token) {
    let jwt = '';

    try {
      const response = await fetch(`${this.#endpoint}/${token}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { response: { accessToken } } = await response.json();

      jwt = accessToken;
    } catch (error) {
      console.error('Failed to fetch JWT token:', error);
    }

    return jwt;
  };
}

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
   *
   * @type {number | null} timeout ID
   */
  #reconnectionTimeout = null;

  /**
   *
   * @type {EventSource}
   */
  #eventSource = null;

  /**
   *
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
   *
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

class DataService {
  /**
   * @type {string}
   */
  #ref = '';
  /**
   * @type {string}
   */
  #token = '';

  /**
   * @type {SSEService}
   */
  #sseService;

  /**
   * @type {ConnectionService}
   */
  #connectionService;

  /**
   * @type {number}
   */
  goal = 0;
  /**
   * @type {number}
   */
  raised = 0;

  /**
   * @returns {number}
   */
  get percent() {
    return (this.raised / this.goal) || 0;
  }

  /**
   * @param {{ref: string, token: string}} goal
   */
  constructor({ token, ref }) {
    this.#token = token;
    this.#ref = ref;

    this.#connectionService = new ConnectionService(token, ref);
    this.#sseService = new SSEService(ref, this.#connectionService);

    document.addEventListener(`${ref}_sse_data`, ({ detail }) => this.handleData(detail));

    this.#init();
  }

  async #init() {
    const { goal, raised } = await this.#connectionService.getData();
    this.goal = goal;
    this.raised = raised;

    this.#sseService.start();
  }

  /**
   * @param {{ raised: number, goal: number? }} data
   */
  handleData({ raised, goal }) {
    this.raised = raised;

    if (goal != null) {
      this.goal = goal;
    }

    document.dispatchEvent(new CustomEvent(
      `${this.#ref}_data`,
      {
        detail: { raised, goal, percent: this.percent },
      },
    ));
  }
}

class DataController {
  /**
   * @type {DataService}
   */
  #dataService;
  /**
   * @type {DataService}
   */
  #dataServiceReverse;

  get percent() {
    let percent = this.#dataService.percent;

    if(this.#dataServiceReverse) {
      const percentReverse = this.#dataServiceReverse.percent;
      percent = percent - percentReverse;
    }

    return percent;
  }

  /**
   *
   * @param {{ref: string, token: string}} goal
   * @param {{ref: string, token: string}?} goalReverse
   */
  constructor(goal, goalReverse) {
    document.addEventListener(`${goal.ref}_data`, () => this.#update(goal.ref));
    this.#dataService = new DataService(goal);

    if (goalReverse) {
      document.addEventListener(`${goalReverse.ref}_data`, () => this.#update(goalReverse.ref));
      this.#dataServiceReverse = new DataService(goalReverse);
    }
  }

  #update() {
    const detail = {
      percent: this.percent,
      goal: {
        goal: this.#dataService.goal,
        raised: this.#dataService.raised,
        percent: this.#dataService.percent,
      },
    };

    if (this.#dataServiceReverse) {
      detail.goalReverse = {
        goal: this.#dataServiceReverse.goal,
        raised: this.#dataServiceReverse.raised,
        percent: this.#dataServiceReverse.percent,
      };
    }

    document.dispatchEvent(new CustomEvent('goal_updated', { detail }));
  }
}

export default DataController;
