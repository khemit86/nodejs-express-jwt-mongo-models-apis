const CMS = require("../../models/cms.model");
const Country = require("../../models/countries.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const mongoosePaginate = require("mongoose-paginate-v2");
const fs = require("fs");
const path = require("path");
const csv = require("csvtojson");
const async = require("async");
const _ = require("lodash");
const { Types } = require("mongoose");
const { addLog } = require("../../helpers/helper");
var moment = require("moment");
var momentTz = require("moment-timezone");

module.exports = {
  add_cms: async (req, res) => {
    try {
      const {
        title,
        description,
        meta_title,
        meta_keyword,
        meta_description,
        country_id,
      } = req.body;
      // var result = await CMS.findOne({ title, country_id });
      // if (result) {
      //   return res.json(
      //     responseData("CMS with same title already exists.", {}, req, false)
      //   );
      // }
      const all_country = await Country.find({}, { _id: 1 });
      for(let item=0;item<all_country.length; item++) {
        await CMS.create({
          title,
          description,
          meta_title,
          meta_keyword,
          meta_description,
          country_id: all_country[item]?._id,
        });
      }
      // if (!isEmpty(cms)) {
        return res.json(responseData("CMS_ADDED", cms, req, true));
      // } else {
      //   return res.json(responseData("ERROR_OCCUR", {}, req, false));
      // }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  delete_cms: async (req, res) => {
    try {
      const cms = await CMS.findOneAndRemove({
        _id: req.params.id,
      });
      if (!isEmpty(cms)) {
        return res.json(responseData("CMS_DELETED", {}, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_cms: async (req, res) => {
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
      
      if (country_id) {
        match.country_id = Types.ObjectId(country_id);
      }

      if (keyword) {
        match["$or"] = [
          { title: { $regex: keyword, $options: "i" } },
          // { slug: { $regex: keyword, $options: "i" } },
          // { description: { $regex: keyword, $options: "i" } },
          //  { meta_title: { $regex: keyword, $options: "i" } },
          //  { meta_keyword: { $regex: keyword, $options: "i" } },
          //  { meta_description: { $regex: keyword, $options: "i" } },
          //  { "country.name": { $regex: keyword, $options: "i" } },
        ];
      }

      const query = CMS.aggregate([
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
            title: 1,
            slug: 1,
            description: 1,
            meta_title: 1,
            meta_keyword: 1,
            meta_description: 1,
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
      var finaldata = await CMS.aggregatePaginate(query, options);
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  edit_cms: async (req, res) => {
    try {
      const {
        _id,
        title,
        description,
        meta_title,
        meta_keyword,
        meta_description,
      } = req.body;

      const serviceValue = {};
      if (title) serviceValue.title = title;
      if (description) serviceValue.description = description;
      if (meta_title) serviceValue.meta_title = meta_title;
      if (meta_keyword) serviceValue.meta_keyword = meta_keyword;
      if (meta_description) serviceValue.meta_description = meta_description;

      var cmsOld = await CMS.findOne({
        _id: { $eq: _id },
      });

      const cms = await CMS.findByIdAndUpdate({ _id }, serviceValue, {
        new: true,
      });

      let logMessage = "";
      if (cms.meta_title != cmsOld.meta_title) {
        logMessage +=
          " </br> Meta Title :   " +
          cmsOld.meta_title +
          " to " +
          cms.meta_title;
      }
      if (cms.meta_keyword != cmsOld.meta_keyword) {
        logMessage +=
          " </br> Meta Keyword :   " +
          cmsOld.meta_keyword +
          " to " +
          cms.meta_keyword;
      }
      if (cms.meta_description != cmsOld.meta_description) {
        logMessage +=
          " </br> Meta Description :   " +
          cmsOld.meta_description +
          " to " +
          cms.meta_description;
      }
      if (cms.description != cmsOld.description) {
        logMessage +=
          " </br> Description :   " +
          cmsOld.description +
          " to " +
          cms.description;
      }
      if (logMessage != "") {
        addLog(req.user._id, "CMS Updated", cms.title, logMessage, cms._id);
      }
      if (!isEmpty(cms)) {
        return res.json(responseData("CMS_UPDATED", cms, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  change_status_cms: async (req, res) => {
    try {
      const { id } = req.params;
      const cmsDetail = await CMS.findOne({ _id: id });
      let status = cmsDetail?.status == 1 ? 0 : 1;
      const cms = await CMS.findOneAndUpdate(
        { _id: id },
        { status },
        { new: true }
      );
      if (!isEmpty(cms)) {
        return res.json(responseData("CMS_STATUS_UPDATED", cms, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
