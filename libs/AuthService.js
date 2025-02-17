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

export default AuthService;
