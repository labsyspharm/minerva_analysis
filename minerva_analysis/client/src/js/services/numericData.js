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
  get floatRange() {
      return this.dataLayer.getImageBitRange(true);
  }

  /*
   * Access DataLayer bitrange as an integer.
   */
  get intRange() {
      return this.dataLayer.getImageBitRange(false);
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
   * @function getAllFloat32Ids - all integer entries
   * @param keys - list of keys to access
   */
  async getAllFloat32Entries(keys) {
      const constructor = (arr) => {
          return new Float32Array(arr);
      }
      return this.getAllEntries(keys, constructor);
  }

  /*
   * @function getAllInt32Ids - all integer entries
   * @param keys - list of keys to access
   */
  async getAllInt32Entries(keys) {
      const constructor = (arr) => {
          return new Uint32Array(arr);
      }
      return this.getAllEntries(keys, constructor);
  }

  /*
   * @function getAllEntries - all cell entries by keys
   * @param keys - list of keys to access
   * @param constructor - a typed array constructor
   */
  async getAllEntries(keys, constructor) {
      if (!keys.length) {
          return [];
      }
      const { dataLayer } = this;
      const arr = await dataLayer.getAllCells(keys);
      const output = constructor(arr);
      return output;
  }
}
