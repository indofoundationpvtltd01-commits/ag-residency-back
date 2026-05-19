class ApiFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  search(fields = ['name', 'description', 'city']) {
    if (this.queryString.search) {
      const regex = new RegExp(this.queryString.search, 'i');
      const searchConditions = fields.map((field) => ({ [field]: regex }));
      this.query = this.query.find({ $or: searchConditions });
    }
    return this;
  }

  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search', 'order', 'sortBy'];
    excludedFields.forEach((el) => delete queryObj[el]);

    // Remove empty string filters
    Object.keys(queryObj).forEach(key => {
      if (queryObj[key] === '') delete queryObj[key];
    });

    // Handle price range
    if (queryObj.minPrice || queryObj.maxPrice) {
      const priceFilter = {};
      if (queryObj.minPrice) priceFilter.$gte = Number(queryObj.minPrice);
      if (queryObj.maxPrice) priceFilter.$lte = Number(queryObj.maxPrice);
      queryObj.minPrice = priceFilter;
      delete queryObj.maxPrice;
    }

    // Handle amenities (comma-separated)
    if (queryObj.amenities) {
      queryObj.amenities = { $all: queryObj.amenities.split(',') };
    }

    // Handle star rating
    if (queryObj.rating) {
      queryObj.starRating = { $gte: Number(queryObj.rating) };
      delete queryObj.rating;
    }

    this.query = this.query.find(queryObj);
    return this;
  }

  sort() {
    const sortBy = this.queryString.sortBy || 'createdAt';
    const order = this.queryString.order === 'asc' ? 1 : -1;
    this.query = this.query.sort({ [sortBy]: order });
    return this;
  }

  paginate(defaultLimit = 10) {
    const page = Math.max(1, parseInt(this.queryString.page) || 1);
    const limit = Math.min(100, parseInt(this.queryString.limit) || defaultLimit);
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    this.page = page;
    this.limit = limit;
    return this;
  }
}

module.exports = ApiFeatures;
