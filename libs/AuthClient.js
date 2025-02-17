class AuthClient {
  /**
   *
   * @type {string}
   */
  #authEndpoint = 'https://api.donatty.com/auth/tokens';
  /**
   *
   * @type {string}
   */
  #authToken = '';
  /**
   *
   * @type {string}
   */
  #jwtToken = '';

  /**
   *
   * @returns {string}
   */
  get jwt() {
    return this.#jwtToken
  }

  constructor(authToken) {
    this.#authToken = authToken;
  }

  async #fetchJwtToken() {
    try {
      const response = await fetch(`${this.#authEndpoint}/${this.#authToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { response: { accessToken } } = await response.json();

      this.#jwtToken = accessToken;
    } catch (error) {
      console.error('Failed to fetch JWT token:', error);

      throw error;
    }
  }

  async auth() {
    if (!this.#authToken) {
      console.error('Token is missing in the URL');
      return;
    }

    await this.#fetchJwtToken();
  }
}

export default AuthClient;
