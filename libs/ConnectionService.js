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

export default ConnectionService;
