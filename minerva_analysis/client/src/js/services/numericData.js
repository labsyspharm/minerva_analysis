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
   * Load cell segmentation data
   */
  async loadCells() {
      const { idField, xCoordinate, yCoordinate } = this.features;
      const fields = [ idField, xCoordinate, yCoordinate ];
      const idsCenters = await this.getAllUInt32Entries(fields);
      const isCenter = (_, i) => !!(i % fields.length);
      const centers = idsCenters.filter(isCenter);
      const isId = (_, i) => !(i % fields.length);
      const ids = idsCenters.filter(isId);
      return { ids, centers };
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
      return this.getAllEntries(keys, false);
  }

  /*
   * @function getAllUInt32Ids - all integer entries
   * @param keys - list of keys to access
   */
  async getAllUInt32Entries(keys) {
      return this.getAllEntries(keys, true);
  }

  /*
   * @function getAllEntries - all cell entries by keys
   * @param keys - list of keys to access
   * @param useInt - whether requesting integers
   */
  async getAllEntries(keys, useInt) {
      if (!keys.length) {
          return [];
      }
      const { dataLayer } = this;
      const arr = await dataLayer.getAllCells(keys, useInt);
      if (useInt) {
          return new Uint32Array(arr);
      }
      return new Float32Array(arr);
  }
}
