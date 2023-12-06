const Offer = require("../../models/offers.model");
const User = require("../../models/user.model");
const BulkNotification = require("../../models/bulknotification.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const { capitalizeFirstLetter } = require("../../helpers/helper");
const _ = require("lodash");
var momentTz = require("moment-timezone");
const { base64Encode, base64Decode, addLog, sliceIntoChunks } = require("../../helpers/helper");
const { Types } = require("mongoose");

module.exports = {
  offerList: async (req, res) => {
    //console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)
    //console.log(moment.tz.guess());
    // console.log(moment.utc().toISOString());
    try {
      let {
        page,
        limit,
        status,
        sort_by,
        keyword,
        country_id,
        sort_type,
        timezone,
        start_date,
        end_date,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "created_at"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        sort_by: sortOptions,
        lean:true,
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
          { code: { $regex: keyword, $options: "i" } },
          { name: { $regex: keyword, $options: "i" } },
          // { "country.name": { $regex: keyword, $options: "i" } },
        ];
      }

      const query = Offer.aggregate([
        {
          $match: match,
        },
        {
          $lookup: {
            from: "countries",
            localField: "country_id",
            foreignField: "_id",
            as: "country",
          },
        },
        {
          $unwind: {
            path: "$country",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Offer.aggregatePaginate(query, options);
      finaldata.docs.map((item,key)=>{
        // console.log('->>>>>>>>ffff',item);
        item['user_id']={_id:item.user_id};
      });
      // console.log('->>>>>>>>ffff',finaldata);
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  add_offer: async (req, res) => {
    try {
      //console.log(moment.utc().toISOString());

      const {
        name,
        discount,
        code,
        expiry_date,
        description,
        offer_type,
        max_use,
        country_id,
        user_id,
        min_order_value
      } = req.body;
      if (name) {
        var newName = capitalizeFirstLetter(name);
      }
      var result = await Offer.findOne({ code, country_id });
      if (result) {
        return res.json(
          responseData("Offer with same code already exists.", {}, req, false)
        );
      }
      if (discount > min_order_value) {
        return res.json(
          responseData("DISCOUNT_IS_MORE_MIN_ORDER_VALUE", {}, req, false)
        );
      }

      var user = {
        name: newName,
        discount,
        code,
        expiry_date,
        description,
        max_use,
        country_id,
        offer_type,
        min_order_value
      };
      if (user_id) {
        user.user_id = user_id;
      }
      const offer_add = await Offer.create(user);
      ///
      var match = {};
      match._id = offer_add._id;
      var pipeline = [
        { $match: match },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            discount: 1,
            name: 1,
            description: 1,
            code: 1,
            expiry_date: 1,
            max_use: 1,
            country_id: 1,
            offer_type: 1,
            "user._id": { $ifNull: ["$user._id", ""] },
            "user.first_name": { $ifNull: ["$user.first_name", ""] },
            "user.last_name": { $ifNull: ["$user.last_name", ""] },
          },
        },
      ];
      const getNewOffer = await Offer.aggregate(pipeline);

      let logMessage = "Name :   " + getNewOffer[0].name;
      logMessage += " </br> Discount :   " + getNewOffer[0].discount;
      logMessage += " </br> Code :   " + getNewOffer[0].code;
      logMessage += " </br> Expiry Date :   " + getNewOffer[0].expiry_date;
      logMessage += " </br> Description :   " + getNewOffer[0].description;
      logMessage += " </br> Offer Type :   " + getNewOffer[0].offer_type;
      logMessage += " </br> Max Use :   " + getNewOffer[0].max_use;
      logMessage +=
        " </br> User :   " +
        base64Decode(getNewOffer[0].user.first_name) +
        " " +
        base64Decode(getNewOffer[0].user.last_name);

      addLog(
        req.user._id,
        "Offer Added",
        getNewOffer[0].name,
        logMessage,
        getNewOffer[0]._id
      );

      ///
      if (offer_add) {
        return res.json(
          responseData("OFFER_ADD_SUCCESS", offer_add, req, true)
        );
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  edit_offer: async (req, res) => {
    try {
      const {
        name,
        discount,
        code,
        expiry_date,
        description,
        offer_type,
        max_use,
        _id,
        country_id,
        user_id,
        min_order_value
      } = req.body;
      if (name) {
        var newName = capitalizeFirstLetter(name);
      }
      var result = await Offer.findOne({
        country_id: country_id,
        code: code,
        _id: { $ne: _id },
      });

      if (result) {
        return res.json(
          responseData("Offer with same code already exists.", {}, req, false)
        );
      }
      if (discount > min_order_value) {
        return res.json(
          responseData("DISCOUNT_IS_MORE_MIN_ORDER_VALUE", {}, req, false)
        );
      }

      ///
      var match = {};
      match._id = Types.ObjectId(_id);
      var pipeline = [
        { $match: match },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 1,
            discount: 1,
            name: 1,
            description: 1,
            code: 1,
            expiry_date: 1,
            max_use: 1,
            country_id: 1,
            offer_type: 1,
            "user._id": { $ifNull: ["$user._id", ""] },
            "user.first_name": { $ifNull: ["$user.first_name", ""] },
            "user.last_name": { $ifNull: ["$user.last_name", ""] },
          },
        },
      ];

      const updateValue = {};
      if (name) updateValue.name = newName;
      if (expiry_date) updateValue.expiry_date = expiry_date;
      if (description) updateValue.description = description;
      if (max_use) updateValue.max_use = max_use;
      if (discount) updateValue.discount = discount;
      if (code) updateValue.code = code;
      if (offer_type) updateValue.offer_type = offer_type;
      if (min_order_value) updateValue.min_order_value = min_order_value;
      if (user_id) {
        updateValue.user_id = user_id;
      }
      const getOldOffer = await Offer.aggregate(pipeline);
      const resp = await Offer.updateOne({ _id: _id }, updateValue);
      if (user_id == "") {
        await Offer.updateOne({ _id: _id }, { $unset: { user_id: 1 } });
      }
      const getNewOffer = await Offer.aggregate(pipeline);

      let logMessage = "";
      if (getNewOffer[0].user.first_name != getOldOffer[0].user.first_name) {
        logMessage +=
          " </br> UserName :   " +
          base64Decode(getOldOffer[0].user.first_name) +
          " " +
          base64Decode(getOldOffer[0].user.last_name);
        " to " +
          +base64Decode(getNewOffer[0].user.first_name) +
          " " +
          base64Decode(getNewOffer[0].user.last_name);
      }
      if (getNewOffer[0].name != getOldOffer[0].name) {
        logMessage +=
          " </br> Name :   " +
          getOldOffer[0].name +
          " to " +
          getNewOffer[0].name;
      }
      if (getNewOffer[0].discount != getOldOffer[0].discount) {
        logMessage +=
          " </br> Discount :   " +
          getOldOffer[0].discount +
          " to " +
          getNewOffer[0].discount;
      }
      if (getNewOffer[0].expiry_date != getOldOffer[0].expiry_date) {
        logMessage +=
          " </br> Expiry Date :   " +
          getOldOffer[0].expiry_date +
          " to " +
          getNewOffer[0].expiry_date;
      }
      if (getNewOffer[0].description != getOldOffer[0].description) {
        logMessage +=
          " </br> Description :   " +
          getOldOffer[0].description +
          " to " +
          getNewOffer[0].description;
      }
      if (getNewOffer[0].max_use != getOldOffer[0].max_use) {
        logMessage +=
          " </br> Max Use :   " +
          getOldOffer[0].max_use +
          " to " +
          getNewOffer[0].max_use;
      }
      if (getNewOffer[0].code != getOldOffer[0].code) {
        logMessage +=
          " </br> Max Use :   " +
          getOldOffer[0].code +
          " to " +
          getNewOffer[0].code;
      }
      if (getNewOffer[0].offer_type != getOldOffer[0].offer_type) {
        logMessage +=
          " </br> Max Use :   " +
          getOldOffer[0].offer_type +
          " to " +
          getNewOffer[0].offer_type;
      }
      if (getNewOffer[0].min_order_value != getOldOffer[0].min_order_value) {
        logMessage +=
          " </br> Minimum Order Value :   " +
          getOldOffer[0].min_order_value +
          " to " +
          getNewOffer[0].min_order_value;
      }
      if (logMessage != "") {
        addLog(
          req.user._id,
          "Offer Updated",
          getNewOffer[0].name,
          logMessage,
          getNewOffer[0]._id
        );
      }
      if (resp.modifiedCount) {
        return res.json(responseData("OFFER_UPDATE_SUCCESS", {}, req, true));
      } else {
        return res.json(responseData("OFFER_NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  delete_offer: async (req, res) => {
    try {
      const { id } = req?.params;
      const resp = await Offer.findOneAndDelete({ _id: id });
      if (resp) {
        return res.json(responseData("OFFER_DELETE", {}, req, true));
      } else {
        return res.json(responseData("OFFER_NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  offer_change_status: async (req, res) => {
    try {
      const { status } = req.body;
      const resp = await Offer.updateOne(
        { _id: req.params.id },
        { $set: { status } }
      );
      if (resp.modifiedCount) {
        return res.json(responseData("OFFER_STATUS_UPDATE", {}, req, true));
      } else {
        return res.json(responseData("OFFER_NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  send_offer_notification: async (req, res) => {
    try {
      const { code, customers } = req.body;

      var allUsers = [];

      for(let item=0; item<customers.length; item++) {
        const user = await User.find({ _id: customers[item]})
        .select("device_token _id");
        allUsers.push(user);
      }
      console.log("allUsers", allUsers)
      
      const allChunks = await sliceIntoChunks(allUsers, 2);
      var dataToInsert = [];
      const message= `New Coupon Code is: ${code}`;
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
