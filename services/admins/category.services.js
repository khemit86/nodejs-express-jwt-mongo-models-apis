const Category = require("../../models/category.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const { addLog } = require("../../helpers/helper");
const _ = require("lodash");
const { Types } = require("mongoose");
const { saveFile, saveThumbFile } = require("../../helpers/helper");
const exists = require("fs-await-exists");
const Promise = require("bluebird");
const {
  CATEGORY_FOLDER,
  CATEGORY_THUMB_WIDTH,
  CATEGORY_THUMB_HEIGHT,
} = require("../../helpers/config");
var moment = require("moment");
var momentTz = require("moment-timezone");

module.exports = {
  add_category: async (req, res) => {
    try {
      const { name, parent, country_id, show_home } = req.body;

      // uploadImageStart
      var image = "";
      const files = req.files;
      if (files && files.image) {
        const data = files.image;
        if (data.name) {
          if (files && files.image.name != undefined) {
            image = await saveFile(files.image, CATEGORY_FOLDER, null);
            await saveThumbFile(
              files.image,
              CATEGORY_FOLDER,
              null,
              image,
              CATEGORY_THUMB_WIDTH,
              CATEGORY_THUMB_HEIGHT,
              `public/${CATEGORY_FOLDER}/thumb`
            );
          }
        }
      }
      // uploadImageEnd

      var result = await Category.findOne({ name, country_id });
      if (result) {
        return res.json(
          responseData(
            "Category with same name already exists.",
            {},
            req,
            false
          )
        );
      }
      //parent =
      const category = await Category.create({
        name,
        show_home,
        image,
        parent,
        country_id,
      });

      //
      let pipeline = [];
      let match = {};
      match._id = Types.ObjectId(category._id);
      pipeline.push(
        { $match: match },
        {
          $lookup: {
            from: "categories",
            localField: "parent",
            foreignField: "_id",
            as: "parent",
          },
        },
        {
          $unwind: {
            path: "$parent",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            name: 1,
            "parent._id": { $ifNull: ["$parent._id", ""] },
            "parent.name": { $ifNull: ["$parent.name", ""] },
          },
        }
      );
      const getNewCategory = await Category.aggregate(pipeline);
      let logMessage = "";
      logMessage += " </br> Name :   " + getNewCategory[0].name;
      logMessage += " </br> Parent :  " + getNewCategory[0].parent.name;
      addLog(
        req.user._id,
        "Category Added",
        getNewCategory[0].name,
        logMessage,
        getNewCategory[0]._id
      );
      //

      if (!isEmpty(category)) {
        return res.json(responseData("CATEGORY_ADDED", category, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      console.log(error);
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  delete_category: async (req, res) => {
    try {
      const category = await Category.findOneAndRemove({ _id: req.params.id });
      if (!isEmpty(category)) {
        return res.json(responseData("CATEGORY_DELETED", {}, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_category: async (req, res) => {
    try {
      console.log(req.user);
      let {
        page,
        limit,
        status,
        sort_by,
        keyword,
        parent_id,
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
        lean: true,
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
      if (parent_id) {
        match.parent = Types.ObjectId(parent_id);
      }

      if (keyword) {
        match["$or"] = [
          { name: { $regex: keyword, $options: "i" } },
          // { "country.name": { $regex: keyword, $options: "i" } },
        ];
      }

      let pipeline = [];

      pipeline.push(
        { $match: match },
        {
          $lookup: {
            from: "categories",
            localField: "parent",
            foreignField: "_id",
            as: "parent",
          },
        },
        {
          $unwind: {
            path: "$parent",
            preserveNullAndEmptyArrays: true,
          },
        }
      );
      pipeline.push(
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
          $project: {
            _id: 1,
            image: 1,
            show_home: 1,
            name: 1,
            latitude: 1,
            longitude: 1,
            address: 1,
            "parent._id": { $ifNull: ["$parent._id", ""] },
            "parent.name": { $ifNull: ["$parent.name", ""] },
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
        }
      );

      const query = Category.aggregate(pipeline).collation({
        locale: "en",
        strength: 1,
      });

      var finaldata = await Category.aggregatePaginate(query, options);

      await Promise.map(finaldata.docs, async (el, index) => {
        let image = el.image;
        console.log("public/" + CATEGORY_FOLDER + image);
        const fileExists = await exists(
          "public/" + CATEGORY_FOLDER + "/" + image
        );

        if (fileExists == false) {
          el.image = "noImage.png";
        }
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
  home_list_category: async (req, res) => {
    try {
      console.log(req.user);
      let {
        page,
        limit,
        status,
        sort_by,
        keyword,
        parent,
        country_id,
        sort_type,
        start_date,
        end_date,
        timezone,
      } = req.query;
      keyword = _.trim(keyword);
      const sortOptions = {
        [sort_by || "order_cat"]: sort_type === "asc" ? -1 : 1,
      };
      const options = {
        page: page || 1,
        limit: limit || 10,
        lean: true,
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
      if (parent) {
        match.parent = Types.ObjectId(parent);
      }

      match.show_home = 1;

      if (keyword) {
        match["$or"] = [
          { name: { $regex: keyword, $options: "i" } },
          // { "country.name": { $regex: keyword, $options: "i" } },
        ];
      }

      let pipeline = [];

      pipeline.push(
        { $match: match },
        {
          $lookup: {
            from: "categories",
            localField: "parent",
            foreignField: "_id",
            as: "parent",
          },
        },
        {
          $unwind: {
            path: "$parent",
            preserveNullAndEmptyArrays: true,
          },
        }
      );
      pipeline.push(
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
          $project: {
            _id: 1,
            image: 1,
            name: 1,
            order_cat: 1,
            latitude: 1,
            longitude: 1,
            address: 1,
            "parent._id": { $ifNull: ["$parent._id", ""] },
            "parent.name": { $ifNull: ["$parent.name", ""] },
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
        }
      );

      const query = Category.aggregate(pipeline).collation({
        locale: "en",
        strength: 1,
      });

      var finaldata = await Category.aggregatePaginate(query, options);

      await Promise.map(finaldata.docs, async (el, index) => {
        let image = el.image;
        console.log("public/" + CATEGORY_FOLDER + image);
        const fileExists = await exists(
          "public/" + CATEGORY_FOLDER + "/" + image
        );

        if (fileExists == false) {
          el.image = "noImage.png";
        }
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
  search_list_category: async (req, res) => {
    try {
      console.log(req.user);
      let { sort_by, country_id, sort_type } = req.query;
      const sortOptions = {
        [sort_by || "order_cat"]: sort_type === "asc" ? -1 : 1,
      };

      var match = {};
      if (country_id) {
        match.country_id = Types.ObjectId(country_id);
      }
      let pipeline = [];

      pipeline.push({ $match: match });
      pipeline.push(
        {
          $project: {
            _id: 1,
            name: 1,
          },
        },
        {
          $sort: sortOptions,
        }
      );

      const finaldata = await Category.aggregate(pipeline).collation({
        locale: "en",
        strength: 1,
      });

      //var finaldata = await Category.aggregatePaginate(query, options);

      // await Promise.map(finaldata.docs, async (el, index) => {
      //   let image = el.image;
      //   console.log("public/" + CATEGORY_FOLDER + image);
      //   const fileExists = await exists(
      //     "public/" + CATEGORY_FOLDER + "/" + image
      //   );

      //   if (fileExists == false) {
      //     el.image = "noImage.png";
      //   }
      // });
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", [], req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  edit_category: async (req, res) => {
    try {
      const { _id, name, parent, country_id, show_home } = req.body;

      var result = await Category.findOne({
        country_id: country_id,
        name: name,
        _id: { $ne: _id },
      });
      if (result) {
        return res.json(
          responseData(
            "Category with same name already exists.",
            {},
            req,
            false
          )
        );
      }
      let categoryExist = await Category.findById(_id);
      // uploadImageStart
      var image = "";
      const files = req.files;
      if (files && files.image) {
        const data = files.image;
        if (data.name) {
          if (files && files.image.name != undefined) {
            image = await saveFile(
              files.image,
              CATEGORY_FOLDER,
              categoryExist.image
            );
            await saveThumbFile(
              files.image,
              CATEGORY_FOLDER,
              categoryExist.image,
              image,
              CATEGORY_THUMB_WIDTH,
              CATEGORY_THUMB_HEIGHT,
              `public/${CATEGORY_FOLDER}/thumb`
            );
          }
        }
      }
      // uploadImageEnd

      const serviceValue = {};
      if (name) serviceValue.name = name;
      if (image) serviceValue.image = image;
      if (parent) serviceValue.parent = parent;
      if (show_home) serviceValue.show_home = show_home;

      //
      let pipeline = [];
      let match = {};
      match._id = Types.ObjectId(_id);
      pipeline.push(
        { $match: match },
        {
          $lookup: {
            from: "categories",
            localField: "parent",
            foreignField: "_id",
            as: "parent",
          },
        },
        {
          $unwind: {
            path: "$parent",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            name: 1,
            "parent._id": { $ifNull: ["$parent._id", ""] },
            "parent.name": { $ifNull: ["$parent.name", ""] },
          },
        }
      );
      const getOldCategory = await Category.aggregate(pipeline);
      const category = await Category.findByIdAndUpdate({ _id }, serviceValue, {
        new: true,
      });
      const getNewCategory = await Category.aggregate(pipeline);

      let logMessage = "";
      if (getNewCategory[0].parent.name != getOldCategory[0].parent.name) {
        logMessage +=
          " </br> Parent :   " +
          getOldCategory[0].parent.name +
          " to " +
          getNewCategory[0].parent.name;
      }
      if (getNewCategory[0].name != getOldCategory[0].name) {
        logMessage +=
          " </br> Name :   " +
          getOldCategory[0].name +
          " to " +
          getNewCategory[0].name;
      }
      if (logMessage != "") {
        addLog(
          req.user._id,
          "Category Updated",
          getOldCategory[0].name,
          logMessage,
          getNewCategory[0]._id
        );
      }

      if (!isEmpty(category)) {
        return res.json(responseData("CATEGORY_UPDATED", category, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  edit_order_category: async (req, res) => {
    try {
      let { new_order } = req.body;
      new_order.forEach(async function (item, index) {
        const resp = await Category.updateOne(
          { _id: item._id },
          { $set: { order_cat: index + 1 } }
        );
      });
      return res.json(responseData("CATEGORY_UPDATED_ORDER", "", req, true));
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  change_status_category: async (req, res) => {
    try {
      const { id } = req.params;
      const categoryDetail = await Category.findOne({ _id: id });
      let status = categoryDetail?.status == 1 ? 0 : 1;
      const category = await Category.findOneAndUpdate(
        { _id: id },
        { status },
        { new: true }
      );
      addLog(
        req.user._id,
        "Category Status Updated",
        categoryDetail.name,
        status
          ? "Category has been activated"
          : "Category has been deactiavted",
        id
      );
      if (!isEmpty(category)) {
        return res.json(
          responseData("CATEGORY_STATUS_UPDATED", category, req, true)
        );
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
