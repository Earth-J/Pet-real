module.exports = {
    pet: [ // pet list to sell not picture to create more pet
        {
            type: "dog",
            name: "Dog",
            price: 1000,
            level: 1,
            exp: 0,
            nextexp: 100,
            // legacy defaults
            health: 20,
            hungry: 20,
            sleep: 20,
            cleanliness: 20,
            // new defaults
            affection: 20,
            fullness: 20,
            dirtiness: 0,
            fatigue: 0
        },
        {
            type: "cat",
            name: "Cat",
            price: 1000,
            level: 1,
            exp: 0,
            nextexp: 100,
            // legacy defaults
            health: 20,
            hungry: 20,
            sleep: 20,
            cleanliness: 20,
            // new defaults
            affection: 20,
            fullness: 20,
            dirtiness: 0,
            fatigue: 0
        }
    ]
}