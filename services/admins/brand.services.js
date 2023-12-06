const Brand = require("../../models/brand.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const { addLog } = require("../../helpers/helper");
const _ = require("lodash");
const { Types } = require("mongoose");
const {
  BRAND_FOLDER,
  BRAND_THUMB_WIDTH,
  BRAND_THUMB_HEIGHT,
} = require("../../helpers/config");
const { saveFile, saveThumbFile } = require("../../helpers/helper");
var moment = require("moment");
var momentTz = require("moment-timezone");

module.exports = {
  add_brand: async (req, res) => {
    try {
      const { name, country_id } = req.body;

      var result = await Brand.findOne({ name, country_id });
      if (result) {
        return res.json(
          responseData("Brand with same name already exists.", {}, req, false)
        );
      }
      // uploadImageStart
      var image = "";
      const files = req.files;
      if (files && files.image) {
        const data = files.image;
        if (data.name) {
          if (files && files.image.name != undefined) {
            image = await saveFile(files.image, BRAND_FOLDER, null);
            await saveThumbFile(
              files.image,
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
      // uploadImageEnd
      const brand = await Brand.create({ name, country_id, image });
      addLog(
        req.user._id,
        "Brand Added",
        name,
        "New Brand Added with name " + name,
        brand._id
      );
      if (!isEmpty(brand)) {
        return res.json(responseData("BRAND_ADDED", brand, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  delete_brand: async (req, res) => {
    try {
      const brand = await Brand.findOneAndRemove({
        _id: req.params.id,
      });
      if (!isEmpty(brand)) {
        return res.json(responseData("BRAND_DELETED", {}, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_brand: async (req, res) => {
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
          { name: { $regex: keyword, $options: "i" } },
          { "country.name": { $regex: keyword, $options: "i" } },
        ];
      }

      const query = Brand.aggregate([
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
          $match: match,
        },
        {
          $project: {
            _id: 1,
            name: 1,
            image: 1,
            "country._id": { $ifNull: ["$country._id", ""] },
            "country.name": { $ifNull: ["$country.name", ""] },
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
      var finaldata = await Brand.aggregatePaginate(query, options);
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  edit_brand: async (req, res) => {
    try {
      const { _id, name, country_id } = req.body;

      var result = await Brand.findOne({
        country_id: country_id,
        name: name,
        _id: { $ne: _id },
      });

      if (result) {
        return res.json(
          responseData("Brand with same name already exists.", {}, req, false)
        );
      }

      const serviceValue = {};
      if (name) serviceValue.name = name;
      var brandOld = await Brand.findOne({
        _id: { $eq: _id },
      });
      // uploadImageStart
      var image = "";
      const files = req.files;
      if (files && files.image) {
        const data = files.image;
        if (data.name) {
          if (files && files.image.name != undefined) {
            image = await saveFile(files.image, BRAND_FOLDER, brandOld.image);
            await saveThumbFile(
              files.image,
              BRAND_FOLDER,
              brandOld.image,
              image,
              BRAND_THUMB_WIDTH,
              BRAND_THUMB_HEIGHT,
              `public/${BRAND_FOLDER}/thumb`
            );
          }
        }
      }
      // uploadImageEnd
      if (image) serviceValue.image = image;
      const brand = await Brand.findByIdAndUpdate({ _id }, serviceValue, {
        new: true,
      });
      let logMessage = "";
      if (brand.name != brandOld.name) {
        logMessage += " </br> Name :   " + brandOld.name + " to " + brand.name;
        addLog(
          req.user._id,
          "Brand Updated",
          brand.name,
          logMessage,
          brand._id
        );
      }

      if (!isEmpty(brand)) {
        return res.json(responseData("BRAND_UPDATED", brand, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  change_status_brand: async (req, res) => {
    try {
      const { id } = req.params;
      const brandDetail = await Brand.findOne({ _id: id });
      let status = brandDetail?.status == 1 ? 0 : 1;
      const brand = await Brand.findOneAndUpdate(
        { _id: id },
        { status },
        { new: true }
      );
      addLog(
        req.user._id,
        "Brand Status Updated",
        brandDetail.name,
        status ? "Brand has been activated" : "Brand has been deactiavted",
        id
      );
      if (!isEmpty(brand)) {
        return res.json(responseData("BRAND_STATUS_UPDATED", brand, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
