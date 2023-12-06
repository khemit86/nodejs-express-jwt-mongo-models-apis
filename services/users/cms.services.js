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
  
  staticPage: async (req, res) => {
    try {
      let {
        page,
        limit,
        status,
        sort_by,
        country_name,
        slug,
        sort_type,
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
      
      if (country_name) {
        var countryData = await Country.findOne({
          name: { $regex: country_name, $options: "i" }
        });
        match.country_id = Types.ObjectId(countryData?._id);
      }else{
        match.country_id = null;
      }

      if (slug) {
        match.slug = slug;
      }
      

      const finaldata = await CMS.aggregate([
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

      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  
};
