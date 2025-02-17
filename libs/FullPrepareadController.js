class ConnectionService {
  /**
   * @type {string}
   */
  _refToken = '';
  /**
   * @type {string}
   */
  _authToken = '';
  /**
   * @type {string}
   */
  _jwtToken = '';
  /**
   * @type {string}
   */
  _endpoint = 'https://api.donatty.com';

  /**
   * @type AuthService
   */
  _authService;

  /**
   * @param {string} authToken
   * @param {string} refToken
   */
  constructor(authToken, refToken) {
    this._endpoint = this._fmtApiUri(refToken);
    this._authToken = authToken;
    this._refToken = refToken;

    this._authService = new AuthService(this.authEndpoint);
  }

  /**
   * @type {string}
   */
  get authEndpoint() {
    return this._endpoint + `/auth/tokens`;
  }
  /**
   * @type {string}
   */
  get widgetsEndpoint() {
    return this._endpoint + `/widgets/${this._refToken}`;
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
  get _zoneOffset() {
    return (new Date).getTimezoneOffset()
  }

  /**
   * @param {string} ref
   *
   * @returns {string}
   */
  _fmtApiUri = (ref) => {
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

  /**
   *
   * @returns {Promise<string>}
   */
  async _getJWT() {
    return this._authService.getJWT(this._authToken);
  }

  /**
   *
   * @returns {Promise<EventSource>}
   */
  async getSSEConnection() {
    const jwt = await this._getJWT();

    return new EventSource(`${this.sseEndpoint}?jwt=${jwt}&zoneOffset=${this._zoneOffset}`);
  }

  /**
   * @returns {Promise<{goal:number, raised: number}>}
   * @throws {Error} error
   */
  async getData() {
    try {
      const jwt = await this._getJWT();
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
  _retryLimit = 5;

  /**
   * @type {string}
   */
  _endpoint = '';

  /**
   * @type {string}
   */
  _token = '';

  /**
   * @type {string}
   */
  _jwt = '';

  /**
   * @param {string} endpoint
   */
  constructor(endpoint) {
    this._endpoint = endpoint;
  };

  /**
   * @param {string} token
   *
   * @returns {Promise<string>}
   */
  async getJWT(token) {
    if (this._jwt) {
      return this._jwt;
    }

    return this.auth(token);
  }

  /**
   * @param {string} token
   * @param {number?} tryCounter
   *
   * @returns {Promise<string>}
   */
  async auth(token, tryCounter = 0) {
    try {
      const response = await fetch(`${this._endpoint}/${token}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { response: { accessToken } } = await response.json();

      this._token = token;
      this._jwt = accessToken;
    } catch (error) {
      console.error('Failed to fetch JWT token:', error);
      if (tryCounter < this._retryLimit) {
        console.error('Retry...');

        return this.auth(token, tryCounter + 1);
      }
    }

    return this._jwt;
  };
}

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

class DataService {
  /**
   * @type {string}
   */
  _ref = '';
  /**
   * @type {string}
   */
  _token = '';

  /**
   * @type {SSEService}
   */
  _sseService;

  /**
   * @type {ConnectionService}
   */
  _connectionService;

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
    this._token = token;
    this._ref = ref;

    this._connectionService = new ConnectionService(token, ref);
    this._sseService = new SSEService(ref, this._connectionService);

    document.addEventListener(`${ref}_sse_data`, ({ detail }) => this.handleData(detail));

    this._init();
  }

  async _init() {
    const { goal, raised } = await this._connectionService.getData();
    this.goal = goal;
    this.raised = raised;

    this._sseService.start();
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
      `${this._ref}_data`,
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
  _dataService;
  /**
   * @type {DataService}
   */
  _dataServiceOpposite;

  get percent() {
    let percent = this._dataService.percent;

    if(this._dataServiceOpposite) {
      const percentOpposite = this._dataServiceOpposite.percent;
      percent = percent - percentOpposite;
    }

    return percent;
  }

  get diff() {
    let diff = this._dataService.raised;

    if(this._dataServiceOpposite) {
      const raisedOpposite = this._dataServiceOpposite.raised;
      diff = diff - raisedOpposite;
    }

    return diff;
  }

  /**
   * @param {{ref: string, token: string}} goal
   * @param {{ref: string, token: string}?} goalOpposite
   */
  constructor(goal, goalOpposite) {
    document.addEventListener(`${goal.ref}_data`, () => this._update(goal.ref));
    this._dataService = new DataService(goal);

    if (goalOpposite) {
      document.addEventListener(`${goalOpposite.ref}_data`, () => this._update(goalOpposite.ref));
      this._dataServiceOpposite = new DataService(goalOpposite);
    }
  }

  _update() {
    const detail = {
      percent: this.percent,
      diff: this.diff,
      goal: {
        goal: this._dataService.goal,
        raised: this._dataService.raised,
        percent: this._dataService.percent,
      },
    };

    if (this._dataServiceOpposite) {
      detail.goalOpposite = {
        goal: this._dataServiceOpposite.goal,
        raised: this._dataServiceOpposite.raised,
        percent: this._dataServiceOpposite.percent,
      };
    }

    document.dispatchEvent(new CustomEvent('goal_updated', { detail }));
  }

  /**
   * @param {number?} limit
   * @returns {number}
   */
  getPercents = (limit) => {
    let percent = this.percent;

    if (limit) {
      const diff = this.diff;
      percent = diff / limit;
    }

    return Math.max(Math.min(percent, 1), -1);
  }
}

export default DataController;
