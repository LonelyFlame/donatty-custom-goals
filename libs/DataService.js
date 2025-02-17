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

export default DataService;
