const FAQ = require("../../models/faq.model");
var { isEmpty } = require("lodash");
const { responseData } = require("../../helpers/responseData");

const _ = require("lodash");
const { Types } = require("mongoose");

module.exports = {
  add_faq: async (req, res) => {
    try {
      const { question, answer, country_id } = req.body;
      var result = await FAQ.findOne({ question, country_id });
      if (result) {
        return res.json(
          responseData("FAQ with same name already exists.", {}, req, false)
        );
      }

      const faq = await FAQ.create({ question, answer, country_id });
      if (!isEmpty(faq)) {
        return res.json(responseData("FAQ_ADDED", faq, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  delete_faq: async (req, res) => {
    try {
      const faq = await FAQ.findOneAndRemove({
        _id: req.params.id,
      });
      if (!isEmpty(faq)) {
        return res.json(responseData("FAQ_DELETED", {}, req, true));
      } else {
        return res.json(responseData("ERROR_OCCUR", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  list_faq: async (req, res) => {
    try {
      let { page, limit, status, sort_by, keyword, country_id, sort_type } =
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

      if (keyword) {
        match["$or"] = [
          { question: { $regex: keyword, $options: "i" } },
         // { answer: { $regex: keyword, $options: "i" } },
         // { "country.name": { $regex: keyword, $options: "i" } },
        ];
      }

      const query = FAQ.aggregate([
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
            question: 1,
            answer: 1,
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
      var finaldata = await FAQ.aggregatePaginate(query, options);
      if (!isEmpty(finaldata)) {
        return res.json(responseData("GET_LIST", finaldata, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  edit_faq: async (req, res) => {
    try {
      const { _id, question, answer, country_id } = req.body;

      var result = await FAQ.findOne({
        country_id: country_id,
        question: question,
        _id: { $ne: _id },
      });

      if (result) {
        return res.json(
          responseData("FAQ with same name already exists.", {}, req, false)
        );
      }

      const serviceValue = {};
      if (question) serviceValue.question = question;
      if (answer) serviceValue.answer = answer;

      const faq = await FAQ.findByIdAndUpdate({ _id }, serviceValue, {
        new: true,
      });

      if (!isEmpty(faq)) {
        return res.json(responseData("FAQ_UPDATED", faq, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
  change_status_faq: async (req, res) => {
    try {
      const { id } = req.params;
      const faqDetail = await FAQ.findOne({ _id: id });
      let status = faqDetail?.status == 1 ? 0 : 1;
      const faq = await FAQ.findOneAndUpdate(
        { _id: id },
        { status },
        { new: true }
      );
      if (!isEmpty(faq)) {
        return res.json(responseData("FAQ_STATUS_UPDATED", faq, req, true));
      } else {
        return res.json(responseData("NOT_FOUND", {}, req, false));
      }
    } catch (error) {
      return res.json(responseData("ERROR_OCCUR", error.message, req, false));
    }
  },
};
