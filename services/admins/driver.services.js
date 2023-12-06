const User = require("../../models/user.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const { capitalizeFirstLetter } = require("../../helpers/helper");
var bcrypt = require("bcryptjs");
const moment = require("moment");
const Promise = require("bluebird");
const {
  BRAND_FOLDER,
  BRAND_THUMB_WIDTH,
  BRAND_THUMB_HEIGHT,
} = require("../../helpers/config");
const { saveFile, saveThumbFile } = require("../../helpers/helper");
const { Types } = require("mongoose");
const { base64Encode, base64Decode } = require("../../helpers/helper");

module.exports = {
  adminUserList: async (req, res) => {
    try {
      let {
        page,
        page_size,
        limit,
        keyword,
        status,
        start_date,
        end_date,
        sort_by,
        country_id,
        city_id,
        store_id,
        mobile,
        sort_type,
        order_count
      } = req.query;
      const enddate = moment(end_date).endOf("day");

      
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
      var match2 = {};
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
      if (city_id) {
        match.city_id = Types.ObjectId(city_id);
      }
      if (store_id) {
        match.store_id = Types.ObjectId(store_id);
      }
      if (order_count) {
        match2.total_order = +order_count;
      }
      
      if (start_date && end_date) {
        match.createdAt = {
            $gte: new Date(start_date),
            $lte: new Date(enddate),
          }
        
      } else if (start_date && !end_date) {
        match.createdAt = {
            $gte: new Date(start_date),
            $lte: new Date(Date.now()),
          }
      } else if (!start_date && end_date) {
        match.createdAt = {
            $lte: new Date(enddate),
          }
      }
      if (keyword) {
        match["$or"] = [
          { first_name: { $regex: base64Encode(keyword), $options: "i" } },
          { last_name: { $regex: base64Encode(keyword), $options: "i" } },
          { email: { $regex: base64Encode(keyword), $options: "i" } },
          { mobile: { $regex: base64Encode(keyword), $options: "i" } }
        ];
      }
      
      match.role_id =3;

      const query = User.aggregate([
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
          $lookup: {
            from: "cities",
            localField: "city_id",
            foreignField: "_id",
            as: "city",
          },
        },
        {
          $unwind: {
            path: "$city",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "stores",
            localField: "store_id",
            foreignField: "_id",
            as: "store",
          },
        },
        {
          $unwind: {
            path: "$store",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'orders',
            let: { id: '$_id'},
            pipeline: [
              {
                $match: { 
                  $expr: { 
                    $and: [
                      { $eq: ['$driver_id', '$$id'] }, 
                      { $eq: ['$status', 0] }, 
                      { $eq: ['$is_cancelled', 0] }, 
                      { $gt: ['$delivery_status', 0] }
                    ]
                  }
                }
              }
            ],
            as: 'order'
          }
        },
        {
          $project:{
            first_name: 1,
            last_name: 1,
            password: 1,
            email: 1,
            address: 1,
            country_code: 1,
            mobile: 1,
            status: 1,
            token: 1,
            is_deleted: 10,
            notification_flag: 1,
            zoom_updates: 1,
            employee_code:1,
            otp: 1,
            otp_expiry: 1,
            is_mobile_verified:1,
            profile_updated: 1,
            role_id: 3,
            image:1,
            device_token:1,
            company_name:1,
            company_phone:1,
            company_reg_no:1,
            company_vat_no:1,
            company_reg_date:1,
            company_postal_code:1,
            company_address1:1,
            company_address2:1,
            company_street:1,
            company_image:1,
            approval: 1,
            createdAt: 1,
            updatedAt: 1,
            city_id: 1,
            total_order: { $ifNull: [{ $size: '$order' }, 0]},
            "country._id": { $ifNull: ["$country._id", ""] },
            "country.name": { $ifNull: ["$country.name", ""] },
            "city._id": { $ifNull: ["$city._id", ""] },
            "city.name": { $ifNull: ["$city.name", ""] },
            "store._id": { $ifNull: ["$store._id", ""] },
            "store.name": { $ifNull: ["$store.name", ""] },
          }
        },
        {
          $match: match2
        },
        {
          $sort: sortOptions,
        },
      ]);

      var finaldata = await User.aggregatePaginate(query, options);

      await Promise.map(finaldata.docs, async (el, index) => {
        el.first_name = base64Decode(el.first_name);
        el.last_name = base64Decode(el.last_name);
        el.email = base64Decode(el.email);
        el.mobile = base64Decode(el.mobile); 
        el.country_code = base64Decode(el.country_code); 
      });
      
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("DRIVER_NOT_FOUND", {}, req, true));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  addAdminUser: async (req, res) => {
    try {
      var { first_name, last_name, password, email, country_code, mobile, country_id, city_id, store_id, address, company_postal_code, company_address1, company_address2 } =
        req.body;
      first_name = base64Encode(first_name);
      last_name = base64Encode(last_name);
      email = base64Encode(email);
      mobile = base64Encode(mobile);
      country_code = base64Encode(country_code);
      const findRecord = await User.findOne({ email });
      if (!isEmpty(findRecord)) {
        return res.json(
          responseData("EMAIL_ALREADY_REGISTERED", {}, req, false)
        );
      }
      const findRecordM = await User.findOne({ country_code, mobile });
      if (!isEmpty(findRecordM)) {
        return res.json(
          responseData("MOBILE_ALREADY_REGISTERED", {}, req, false)
        );
      }

      const salt = await bcrypt.genSalt(10);
      //let full_name = capitalizeFirstLetter(name);
      const user = { first_name, last_name, email, country_code, mobile , country_id, city_id, store_id };
      user.org_password = password;
      user.password = await bcrypt.hash(password, salt);
      user.status = true;
      user.role_id = 3;
      user.country_id =Types.ObjectId(country_id);
      user.city_id = Types.ObjectId(city_id);
      user.store_id = Types.ObjectId(store_id);
      user.is_mobile_verified = true;
      user.address = address;
       // uploadImageStart
       var image = "";
       const files = req.files;
       if (files && files.profile_pic) {
         const data = files.profile_pic;
         if (data.name) {
           if (files && files.profile_pic.name != undefined) {
             image = await saveFile(files.profile_pic, BRAND_FOLDER, null);
             await saveThumbFile(
               files.profile_pic,
               BRAND_FOLDER,
               null,
               image,
               BRAND_THUMB_WIDTH,
               BRAND_THUMB_HEIGHT,
               `public/${BRAND_FOLDER}/thumb`
             );
           }
         }
       }
      user.image = image
      user.employee_code=Math.floor(100000 + Math.random() * 9000000);
      if(company_postal_code) user.company_postal_code= company_postal_code;
      if(company_address1) user.company_address1= company_address1;
      if(company_address2) user.company_address2= company_address2;
      const resp = await User.create(user);
      if (resp) {
        const newres = resp.toJSON();
        delete newres["password"];
        newres.first_name = base64Decode(newres.first_name);
        newres.last_name = base64Decode(newres.last_name);
        newres.email = base64Decode(newres.email);
        newres.mobile = base64Decode(newres.mobile);
        newres.country_code = base64Decode(newres.country_code);
        return res.json(responseData("DRIVER_ADD_SUCCESS", newres, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  editAdminUser: async (req, res) => {
    try {
      var { first_name, last_name, password, email, country_code, mobile, country_id, city_id, store_id, address, company_postal_code, company_address1, company_address2 } =
        req.body;
      first_name = base64Encode(first_name);
      last_name = base64Encode(last_name);
      email = base64Encode(email);
      mobile = base64Encode(mobile);
      country_code = base64Encode(country_code);
      if (email) {
        const findRecord = await User.findOne({
          email,
          _id: { $ne: req.params.id },
        });
        if (!isEmpty(findRecord)) {
          return res.json(
            responseData("EMAIL_ALREADY_REGISTERED", {}, req, false)
          );
        }
      }

      if (mobile) {
        const findRecordM = await User.findOne({
          country_code,
          mobile,
          _id: { $ne: req.params.id },
        });
        if (!isEmpty(findRecordM)) {
          return res.json(
            responseData("MOBILE_ALREADY_REGISTERED", {}, req, false)
          );
        }
      }

      const user = { first_name, last_name, email, country_code, mobile,country_id,city_id,store_id,address };
       // uploadImageStart
       var image = "";
       const files = req.files;
       if (files && files.profile_pic) {
         const data = files.profile_pic;
         if (data.name) {
           if (files && files.profile_pic.name != undefined) {
             image = await saveFile(files.profile_pic, BRAND_FOLDER, null);
             await saveThumbFile(
               files.profile_pic,
               BRAND_FOLDER,
               null,
               image,
               BRAND_THUMB_WIDTH,
               BRAND_THUMB_HEIGHT,
               `public/${BRAND_FOLDER}/thumb`
             );
           }
         }
       }
      user.image = image
      if (req.body?.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
      }

      if(company_postal_code) user.company_postal_code= company_postal_code;
      if(company_address1) user.company_address1= company_address1;
      if(company_address2) user.company_address2= company_address2;

      const resp = await User.updateOne({ _id: req.params.id }, { $set: user });
      if (resp.modifiedCount) {
        return res.json(responseData("DRIVER_UPDATE_SUCCESS", {}, req, true));
      } else {
        return res.json(responseData("USER_NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  deleteUser: async (req, res) => {
    try {
      const resp = await User.deleteOne({ _id: req.params.id });
      if (resp.deletedCount) {
        return res.json(responseData("USER_DELETE", {}, req, true));
      } else {
        return res.json(responseData("USER_NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  userChangeStatus: async (req, res) => {
    try {
      const { status } = req.body;
      const resp = await User.updateOne(
        { _id: req.params.id },
        { $set: { status } }
      );
      if (resp.modifiedCount) {
        return res.json(responseData("USER_STATUS_UPDATE", {}, req, true));
      } else {
        return res.json(responseData("DRIVER_NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  userDetail: async (req, res) => {
    try {
      const { _id, status } = req.body;
      const resp = await User.updateOne({ _id }, { $set: { status } });
      if (resp.modifiedCount) {
        return res.json(responseData("USER_STATUS_UPDATE", {}, req, true));
      } else {
        return res.json(responseData("DRIVER_NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  getOneUser: async (req, res) => {
    try {
      const { keyword } = req.query;

      const userExist = await User.aggregate([
        {
          $match: {
            $or: [{ email: keyword }, { mobile: keyword }],
            status: "active",
          },
        },
      ]);

      if (!userExist[0]) {
        return res.json(responseData("USER_NOT_FOUND", {}, req, false));
      }

      delete userExist[0]["password"];

      return res.json(responseData("GET_DETAIL", userExist[0], req, true));
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
