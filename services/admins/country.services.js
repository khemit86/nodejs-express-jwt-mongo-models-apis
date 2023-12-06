const Country = require("../../models/countries.model");
const CMS = require("../../models/cms.model");
const Setting = require("../../models/setting.model");
const Email = require("../../models/emailtemplate.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");
const { addLog } = require("../../helpers/helper");
const fs = require("fs");
const path = require("path");
const csv = require("csvtojson");
const async = require("async");
const _ = require("lodash");
var moment = require("moment");
const { Types } = require("mongoose");
var momentTz = require("moment-timezone");
var countries = require('../../helpers/country_list') 

module.exports = {
  add_country: async (req, res) => {
    try {
      const { name, dial_code,alpha_code } = req.body;
      var result = await Country.findOne({
        name: { $regex: name, $options: "i" },
        dial_code,
      });
      if (result) {
        return res.json(
          responseData("COUNTRY_WITH_SAME_NAME", {}, req, false)
        );
      }
      const { currency, symbol } = countryName(name);
      const country = await Country.create({ name, alpha_code, currency, symbol });
      addLog(
        req.user._id,
        "Country Added",
        name,
        "New Country Added with name " + name,
        country._id
      );
      const all_cms = await CMS.aggregate([
        {
          $group: {
            _id: '$slug',
            title: { $first: '$title'},
            description: { $first: '$description'},
            meta_title: { $first: '$meta_title'},
            meta_keyword: { $first: '$meta_keyword'},
            meta_description: { $first: '$meta_description'}
          }
        }
      ])
      const setting = await Setting.findOne({}).lean()
      const all_email_template = await Email.aggregate([
        {
          $group: {
            _id: '$slug',
            title: { $first: '$title'},
            subject: { $first: '$subject'},
            description: { $first: '$description'},
          }
        }
      ])
      for(let i=0; i<all_cms.length; i++) {
        let obj = all_cms[i];
        delete obj._id;
        obj.country_id = country._id;
        await CMS.create(obj);
      }
      for(let j=0; j<all_email_template.length; j++) {
        let obj = all_email_template[j];
        delete obj._id;
        obj.country_id = country._id;
        await Email.create(obj);
      }
      if(!isEmpty(setting)) {
        delete setting.country_id;
        setting.country_id = country._id;
        delete setting._id;
        await Setting.create(setting);
      }
      if (!isEmpty(country)) {
        return res.json(responseData("COUNTRY_ADDED", country, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  delete_country: async (req, res) => {
    try {
      const country = await Country.findOneAndRemove({
        _id: req.params.id,
      });
      if (!isEmpty(country)) {
        return res.json(responseData("COUNTRY_DELETED", {}, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_country: async (req, res) => {
    try {
      let {
        page,
        limit,
        status,
        sort_by,
        keyword,
        sort_type,
        start_date,
        end_date,
        timezone,
        country_id
      } = req.query;
      keyword = _.trim(keyword);

      const sortOptions = {
        [sort_by || "created_at"]: sort_type === "asc" ? 1 : -1,
      };
      const options = {
        page: page || 1,
        // limit: process.env.ADMIN_LIST_PAGING_LIMIT || 20,
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
        match._id = Types.ObjectId(country_id);
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
        match.name = { $regex: _.trim(keyword), $options: "i" };
      }

      const query = Country.aggregate([
        {
          $project: {
            _id: 1,
            name: 1,
            alpha_code: 1,
            dial_code: 1,
            code: 1,
            currency:1,
            symbol:1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            __v: 1,
          },
        },
        {
          $match: match,
        },
        {
          $sort: sortOptions,
        },
      ]).collation({ locale: "en", strength: 1 });
      var finaldata = await Country.aggregatePaginate(query, options);
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  edit_country: async (req, res) => {
    try {
      const { _id, name, dial_code } = req.body;

      var result = await Country.findOne({
        name: { $regex: name, $options: "i" },
        _id: { $ne: _id },
      });

      if (result) {
        return res.json(
          responseData("Country with same name already exists.", {}, req, false)
        );
      }
      const { currency, symbol } = countryName(name);
      const serviceValue = {};
      if (name) {
        serviceValue.name = name;
        serviceValue.currency = currency;
        serviceValue.symbol = symbol;
      }
      if (dial_code) serviceValue.dial_code = dial_code;

      var countryOld = await Country.findOne({
        _id: { $eq: _id },
      });

      const country = await Country.findByIdAndUpdate({ _id }, serviceValue, {
        new: true,
      });

      let logMessage = "";
      if (country.name != countryOld.name) {
        logMessage +=
          " </br> Name :   " + countryOld.name + " to " + country.name;
        addLog(
          req.user._id,
          "Country Updated",
          country.name,
          logMessage,
          country._id
        );
      }

      if (!isEmpty(country)) {
        return res.json(responseData("COUNTRY_UPDATED", country, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  change_status_country: async (req, res) => {
    try {
      const { id } = req.params;
      const countryDetail = await Country.findOne({ _id: id });
      let status = countryDetail?.status == 1 ? 0 : 1;
      const country = await Country.findOneAndUpdate(
        { _id: id },
        { status },
        { new: true }
      );
      addLog(
        req.user._id,
        "Country Status Updated",
        countryDetail.name,
        status ? "Country has been activated" : "Country has been deactiavted",
        id
      );
      if (!isEmpty(country)) {
        return res.json(
          responseData("COUNTRY_STATUS_UPDATED", country, req, true)
        );
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  add_country_csv: async (req, res) => {
    try {
      const csvFilePath = path.join(
        __dirname,
        "..",
        "..",
        "public",
        "images",
        req.file.filename
      );

      const jsonArray = await csv().fromFile(csvFilePath);

      let array_add = [];
      let array_exist = [];

      async.eachSeries(
        jsonArray,
        (item, callback) => {
          Country.findOne({ name: item.country_name })
            .then((CountryData) => {
              if (CountryData) {
                array_exist.push({ name: CountryData.name });
              } else {
                array_add.push({
                  name: item.country_name,
                  status: item.status == "active" ? 1 : 0,
                  image: null,
                });
              }
              callback(null);
            })
            .catch((err) => {
              callback(err);
            });
        },
        function (error) {
          if (error) {
            return res.json(
              responseData("ERROR_OCCUR", error.message, req, false)
            );
          }
          const key = "name";
          const unique = [
            ...new Map(array_add.map((item) => [item[key], item])).values(),
          ];

          Country.insertMany(unique)
            .then((data) => {
              fs.unlinkSync(csvFilePath);
              return res.json(
                responseData("COUNTRY_ADDED_SUCCESSFULLY", data, req, true)
              );
            })
            .catch((error) => {
              return res.json(
                responseData("ERROR_OCCUR", error.message, req, false)
              );
            });
        }
      );
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};

function countryName(name) {
  var country = countries.filter(x=> x.name == name)
  return country.length > 0 ? country[0] : {}
}