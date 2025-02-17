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

export default AuthService;
