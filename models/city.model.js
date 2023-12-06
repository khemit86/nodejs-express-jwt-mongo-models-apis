const mongoose = require("mongoose")
var aggregatePaginate = require("mongoose-aggregate-paginate-v2")

const CitySchema = new mongoose.Schema({
        name: {
            type: String,
            required: true,
        },
        country_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Countries",
            required: true,
        },
        status: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

CitySchema.plugin(aggregatePaginate)
const City = mongoose.model("City", CitySchema);

module.exports = City;