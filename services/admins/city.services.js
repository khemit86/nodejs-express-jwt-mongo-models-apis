const City = require("../../models/city.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const _ = require("lodash");
const { Types } = require("mongoose");
const { addLog } = require("../../helpers/helper");
var moment = require("moment");
var momentTz = require("moment-timezone");

module.exports = {
  add_city: async (req, res) => {
    try {
      const { name, country_id } = req.body;
      var result = await City.findOne({
        name: { $regex: name, $options: "i" },
        country_id,
      });
      if (result) {
        return res.json(
          responseData("City with same name already exists.", {}, req, false)
        );
      }
      const city = await City.create({ name, country_id });
      addLog(
        req.user._id,
        "City Added",
        name,
        "New City Added with name " + name,
        city._id
      );
      if (!isEmpty(city)) {
        return res.json(responseData("CITY_ADDED", city, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  delete_city: async (req, res) => {
    try {
      const city = await City.findOneAndRemove({
        _id: req.params.id,
      });
      if (!isEmpty(city)) {
        return res.json(responseData("CITY_DELETED", {}, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  get_cities: async (req, res) => {
    try {
      let { keyword, country_id } = req.query;
      const sortOptions = {
        ["name"]: 1,
      };

      var match = {};

      if (country_id) {
        match.country_id = Types.ObjectId(country_id);
      }

      if (keyword) {
        match["name"] = { $regex: _.trim(keyword), $options: "i" };
      }

      const cityData = await City.aggregate([
        {
          $match: match,
        },
        {
          $project: {
            _id: 1,
            name: 1,
            country_id: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });

      if (!isEmpty(cityData)) {
        return res.json(responseData("GET_LIST", cityData, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_city: async (req, res) => {
    try {
      let {
        page,
        limit,
        status,
        sort_by,
        keyword,
        country_id,
        sort_type,
        start_date,
        end_date,
        timezone,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "created_at"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      var match = {};
      if (status) {
        if (status == 1) {
          match.status = true;
        } else if (status == 0) {
          match.status = false;
        }
      }

      if (country_id) {
        match.country_id = Types.ObjectId(country_id);
      }

      if (start_date) {
        start_date = new Date(
          momentTz
            .tz(start_date + " 00:00:00", timezone)
            .utc()
            .toISOString()
        );
      }
      if (end_date) {
        end_date = new Date(
          momentTz
            .tz(end_date + " 23:59:59", timezone)
            .utc()
            .toISOString()
        );
      }

      if (start_date && end_date) {
        match.createdAt = {
          $gte: start_date,
          $lte: end_date,
        };
      } else if (start_date && !end_date) {
        match.createdAt = {
          $gte: start_date,
        };
      } else if (!start_date && end_date) {
        match.createdAt = {
          $lte: end_date,
        };
      }
      if (keyword) {
        match["$or"] = [
          { name: { $regex: keyword, $options: "i" } },
          //{ answer: { $regex: keyword, $options: "i" } },
          { "country.name": { $regex: keyword, $options: "i" } },
        ];
      }

      const query = City.aggregate([
        {
          $lookup: {
            from: "countries",
            localField: "country_id",
            foreignField: "_id",
            as: "country",
          },
        },
        {
          $unwind: "$country",
        },
        {
          $match: match,
        },
        {
          $project: {
            _id: 1,
            name: 1,
            "country._id": 1,
            "country.name": 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await City.aggregatePaginate(query, options);
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  edit_city: async (req, res) => {
    try {
      const { _id, name, country_id } = req.body;

      var result = await City.findOne({
        country_id: country_id,
        name: { $regex: name, $options: "i" },
        _id: { $ne: _id },
      });

      if (result) {
        return res.json(
          responseData("City with same name already exists.", {}, req, false)
        );
      }

      const serviceValue = {};
      if (name) serviceValue.name = name;
      var cityOld = await City.findOne({
        _id: { $eq: _id },
      });

      const city = await City.findByIdAndUpdate({ _id }, serviceValue, {
        new: true,
      });

      let logMessage = "";
      if (city.name != cityOld.name) {
        logMessage += " </br> Name :   " + cityOld.name + " to " + city.name;
        addLog(req.user._id, "City Updated", city.name, logMessage, city._id);
      }

      if (!isEmpty(city)) {
        return res.json(responseData("CITY_UPDATED", city, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  change_status_city: async (req, res) => {
    try {
      const { id } = req.params;
      const cityDetail = await City.findOne({ _id: id });
      let status = cityDetail?.status == 1 ? 0 : 1;
      const city = await City.findOneAndUpdate(
        { _id: id },
        { status },
        { new: true }
      );
      addLog(
        req.user._id,
        "City Status Updated",
        cityDetail.name,
        status ? "City has been activated" : "City has been deactiavted",
        id
      );
      if (!isEmpty(city)) {
        return res.json(responseData("CITY_STATUS_UPDATED", city, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
