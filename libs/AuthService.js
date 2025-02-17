class AuthService {
  #retryLimit = 5;

  /**
   * @type {string}
   */
  #endpoint = '';

  /**
   * @type {string}
   */
  #token = '';

  /**
   * @type {string}
   */
  #jwt = '';

  /**
   * @param {string} endpoint
   */
  constructor(endpoint) {
    this.#endpoint = endpoint;
  };

  /**
   * @param {string} token
   *
   * @returns {Promise<string>}
   */
  async getJWT(token) {
    if (this.#jwt) {
      return this.#jwt;
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
      const response = await fetch(`${this.#endpoint}/${token}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { response: { accessToken } } = await response.json();

      this.#token = token;
      this.#jwt = accessToken;
    } catch (error) {
      console.error('Failed to fetch JWT token:', error);
      if (tryCounter < this.#retryLimit) {
        console.error('Retry...');

        return this.auth(token, tryCounter + 1);
      }
    }

    return this.#jwt;
  };
}

export default AuthService;
