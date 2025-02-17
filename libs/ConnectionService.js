
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

export default ConnectionService;
