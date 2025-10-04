const mongoose = require('mongoose');
const { MONGO_URI } = require('../settings/config.js');

module.exports = async (client) => {
    try {
        mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
    } catch (error) {
        console.log(error);
    }

    mongoose.set('strictQuery', true);

    require("./Database/Handlers.js")(client);
} 