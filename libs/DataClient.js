class DataClient {
  #apiEndpoint = ''
  #authToken = '';
  #refToken = '';

  goal = 0;
  raised = 0;

  /**
   *
   * @type {AuthClient}
   */
  #authClient = null;

  /**
   *
   * @type {SSEClient}
   */
  #sseClient = null;

  get percent() {
    return (this.raised / this.goal) || 0;
  }

  get ref() {
    return this.#refToken;
  }

  /**
   *
   * @param {token: {string}, ref: {string}} tokens
   */
  constructor({token, ref}) {
    this.#authToken = token;
    this.#refToken = ref;

    this.#apiEndpoint = `${fmtApiUri(this.#refToken)}/widgets/${this.#refToken}`;

    this.#init();
  }

  async #init() {
    try {
      this.#authClient = new AuthClient(this.#authToken);
      await this.#authClient.auth();

      await this.#getData();
    } catch (e) {
      console.error('SWW on init, retry...');

      this.#authClient = null;

      setTimeout(() => this.#init(), 5000);

      return;
    }

    const sseClient = new SSEClient(this.#authClient, this.#refToken);
    sseClient.onData = (newRaised, newGoal) => this.#update(newRaised, newGoal);

    sseClient.start();

    this.#sseClient = sseClient;
  }

  async #getData() {
    try {
      const response = await fetch(this.#apiEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.#authClient.jwt}`,
        },
      });

      const { response: { props: { data: { goal, goalCollected } } } } = await response.json();

      this.#update(goalCollected, goal);
    } catch (error) {
      console.error('Failed to fetch initial data:', error);

      throw error;
    }
  }

  /**
   *
   * @param {number} newRaised
   * @param {number?} newGoal
   */
  #update(newRaised, newGoal) {
    this.raised = newRaised;

    if (newGoal) {
      this.goal = newGoal;
    }

    document.dispatchEvent(new CustomEvent(
      'goal_updated',
      {
        detail: {
          goal: this.goal,
          raised: this.raised,
          percent: this.percent,
          ref: this.#refToken,
        },
      },
    ));
  }
};

export default DataController;
