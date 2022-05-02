class NumericData {
  /**
   * Constructor for NumericDataLayer.
   *
   * @param config - the cinfiguration file (json)
   * @param dataLayer - the data layer (stub) that executes server requests and holds client side data
   */
  constructor(config, dataLayer) {
      this.features = config.featureData[0];
      this.dataLayer = dataLayer;
  }

  /*
   * Access DataLayer metadata.
   */
  get metadata() {
      return this.dataLayer.getMetadata();
  }

  /*
   * Access DataLayer bitrange as floating point.
   */
  get bitRange() {
      return this.dataLayer.getImageBitRange(true);
  }

  /*
   * @function getNearestCell - return nearest cell to point
   *
   * @param x - cell x position in image coordinates
   * @param y - cell y position in image coordinates
   */
  getNearestCell(x, y) {
      return this.dataLayer.getNearestCell(x, y);
  }

  /*
   * @function getAllIds - all cell ids
   */
  async getAllIds() {
      const { idField } = this.features;
      return this.getAllEntries([idField]);
  }

  /*
   * @function getAllEntries - all cell entries by keys
   */
  async getAllEntries(keys) {
      const output = [];
      if (!keys.length) {
        return output;
      }
      const { dataLayer } = this;
      for (const list of await dataLayer.getAllCells(keys)) {
        for (const item of list) output.push(item);
      }
      return output;
  }
}
