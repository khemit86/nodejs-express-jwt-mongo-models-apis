const Notification = require("../../models/notification.model");
const BulkNotification = require("../../models/bulknotification.model");
const User = require("../../models/user.model");
const Promise = require("bluebird");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const mongoose = require("mongoose");
const { ObjectId } = require("mongodb");
const firebase_admin = require("../../helpers/fcm_notification");
var moment = require("moment");
const { base64Encode, base64Decode, sliceIntoChunks } = require("../../helpers/helper");

//#check_me_fcm|fcm|provider|Registration Successful
//#check_me_fcm|fcm|New Service Request|?

module.exports = {
  list: async (req, res) => {
    try {
      let { page, limit, sort_by, sort_type, keyword, country_id, start_date, end_date } = req.query;

      let matchQuery = {};
      const sortOptions = {
        [sort_by || "createdAt"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      if (country_id) {
        matchQuery["user.country._id"] = ObjectId(country_id);
      }

      if (keyword) {
        matchQuery["body"] =  { $regex: keyword, $options: "i" }
      }

      if (end_date) {
        end_date = moment(end_date).endOf("day");
      }

      if (start_date && end_date) {
        matchQuery.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date && !end_date) {
        matchQuery.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!start_date && end_date) {
        matchQuery.createdAt = {
          $lte: new Date(end_date),
        };
      }

      const query = Notification.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [
                    { $project: { alpha_code: 1, name: 1 } }
                  ],
                  as: "country",
                },
              },
              {
                $unwind: "$country",
              },
              { $project: { _id: 1, first_name: 1, last_name: 1, email: 1, country: 1 } }
            ],
            as: "user",
          },
        },
        {
          $unwind: "$user",
        },
        {
          $match: matchQuery,
        },
        {
          $project: {
            body: 1,
            model: 1,
            ref_id: 1,
            seen: 1,
            title: 1,
            type: 1,
            createdAt: 1,
            "user": { $ifNull: ["$user", {}] },
            "country": { $ifNull: ["$user.country", {}] },
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Notification.aggregatePaginate(query, options);
      await Promise.map(finaldata.docs, async (el, index) => {
        el.user.first_name = base64Decode(el.user.first_name);
        el.user.last_name = base64Decode(el.user.last_name);
        el.user.email = base64Decode(el.user.email);
      });
      return res.json(responseData("GET_LIST", finaldata, req, true));
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  notification_list: async (req, res) => {
    try {
      let { page, limit,sort_by, sort_type, keyword, country_id, start_date, end_date } = req.query;

      let matchQuery = {}
     const sortOptions = {
        [sort_by || "createdAt"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
      };

      if (country_id) {
        matchQuery["admin.country._id"] = ObjectId(country_id);
      }

      if (keyword) {
        matchQuery["body"] =  { $regex: keyword, $options: "i" }
      }

      if (end_date) {
        end_date = moment(end_date).endOf("day");
      }

      if (start_date && end_date) {
        matchQuery.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(end_date),
        };
      } else if (start_date && !end_date) {
        matchQuery.createdAt = {
          $gte: new Date(start_date),
          $lte: new Date(Date.now()),
        };
      } else if (!start_date && end_date) {
        matchQuery.createdAt = {
          $lte: new Date(end_date),
        };
      }

      const query = Notification.aggregate([
        {
          $match: { user_id: ObjectId(req.user._id) }
        },
        {
          $lookup: {
            from: "admins",
            localField: "user_id",
            foreignField: "_id",
            pipeline: [
              {
                $lookup: {
                  from: "countries",
                  localField: "country_id",
                  foreignField: "_id",
                  pipeline: [
                    { $project: { alpha_code: 1, name: 1 } }
                  ],
                  as: "country",
                },
              },
              {
                $unwind: "$country",
              },
              { $project: { _id: 1, first_name: 1, last_name: 1, email: 1, country: 1 } }
            ],
            as: "admin",
          },
        },
        {
          $unwind: "$admin"
        },
        {
          $match: matchQuery,
        },
        {
          $project: {
            body: 1,
            model: 1,
            ref_id: 1,
            seen: 1,
            title: 1,
            type: 1,
            createdAt: 1,
            "user": { $ifNull: ["$admin", {}] },
            "country": { $ifNull: ["$admin.country", {}] },
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Notification.aggregatePaginate(query, options);
      await Promise.map(finaldata.docs, async (el, index) => {
        el.user.first_name = base64Decode(el.user.first_name);
        el.user.last_name = base64Decode(el.user.last_name);
        el.user.email = base64Decode(el.user.email);
      });
      return res.json(responseData("GET_LIST", finaldata, req, true));
    } catch(error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  send_notification: async (req, res) => {
    try {
      const { message, sendToType } = req.body;
      var allUsers = []
      if (sendToType == "all_users") {
        allUsers = await User.find({ country_id: country_id})
        .select("device_token _id");
      } else if(sendToType == "all_delivery_boy") {
        allUsers = await User.find({ role_id: 3, country_id: country_id })
        .select("device_token _id");
      } else if(sendToType === "all_ios") {
        allUsers = await User.find({ user_type: 2, country_id: country_id })
        .select("device_token _id");
      } else if(sendToType === "all_android") {
        allUsers = await User.find({ user_type: 3, country_id: country_id })
        .select("device_token _id");
      } else {
        return res.json(responseData("TYPE_USER_INVALID_WAY", {}, req, false));
      }
      
      const allChunks = await sliceIntoChunks(allUsers, 2);
      console.log("allChunks", allChunks)
      var dataToInsert = [];
      if (allChunks.length > 0) {
        for (let $i = 0; $i < allChunks.length; $i++) {
          dataToInsert.push({ description: message, users: allChunks[$i] });
        }
        await BulkNotification.insertMany(dataToInsert);
      }
      //return false;
      return res.json(
        responseData("NOTIFICATION_CREATED", {}, req, true)
      );
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
