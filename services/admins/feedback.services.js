const Feedback = require("../../models/feedback.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");

const _ = require("lodash");
const { Types } = require("mongoose");
const Promise = require("bluebird");
const { base64Encode, base64Decode } = require("../../helpers/helper");

module.exports = {
  add_feedback: async (req, res) => {
    try {
      const { user_id, feedback, country_id } = req.body;
      
      const feedback_save = await Feedback.create({ user_id, feedback, country_id });
      if (!isEmpty(feedback_save)) {
        return res.json(responseData("FEEDBACK_ADDED", feedback_save, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_feedback: async (req, res) => {
    try {
      let { page, limit, status, sort_by, keyword, country_id, sort_type,start_date,end_date } =
        req.query;
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

      if (start_date && end_date) {
        match.createdAt = {
            $gte: new Date(start_date),
            $lte: new Date(end_date),
          }
        
      } else if (start_date && !end_date) {
        match.createdAt = {
            $gte: new Date(start_date),
            $lte: new Date(Date.now()),
          }
      } else if (!start_date && end_date) {
        match.createdAt = {
            $lte: new Date(end_date),
          }
      }
      if (keyword) {
        match["$or"] = [
          { feedback: { $regex: keyword, $options: "i" } }
        ];
      }

      const query = Feedback.aggregate([
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
          $lookup:{
            from:"users",
            localField:"user_id",
            foreignField:"_id",
            as:"user"
          },
        },
        {
          $unwind:"$user"
        },
        {
          $match: match,
        },
        {
          $project: {
            _id: 1,
            feedback: 1,
            "country._id": 1,
            "country.name": 1,
            "user._id": 1,
            "user.first_name": 1,
            "user.last_name": 1,
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
      var finaldata = await Feedback.aggregatePaginate(query, options);

      await Promise.map(finaldata.docs, async (el, index) => {
        el.user.first_name = base64Decode(el.user.first_name);
        el.user.last_name = base64Decode(el.user.last_name);
      });

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
