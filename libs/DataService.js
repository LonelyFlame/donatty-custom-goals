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

export default DataService;
