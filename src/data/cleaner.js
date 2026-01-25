/**
 * Cleans and transforms raw CSV records into Product objects.
 * @param {Array} rawRecords - Array of objects from CSV parser.
 * @returns {Array} Array of cleaned Product objects.
 */
function cleanData(rawRecords) {
    return rawRecords
        .map((record, index) => {
            // Basic validation: Must have a name and a price
            if (!record.Strain || !record['Price numeric']) {
                return null;
            }

            // Parse fields
            const id = `prod_${String(index + 1).padStart(3, '0')}`;
            const price = parseFloat(record['Price numeric']);
            const thc = parseFloat(record['THC level numeric']) || 0;

            // Parse effects (split by comma and trim)
            let effects = [];
            if (record.Feelings && record.Feelings !== 'Not Specified') {
                effects = record.Feelings.split(',').map(e => e.trim());
            }

            // Parse type (Capitalize first letter)
            let type = record.Types || 'Unknown';
            type = type.charAt(0).toUpperCase() + type.slice(1);

            return {
                id,
                name: record.Strain,
                company: record.Company,
                type: type,
                category: record.Categories,
                price, // USD
                thc, // Percentage number
                thcDisplay: record['THC level'],
                effects,
                flavor: record.Flavor,
                description: record.Description,
                priceDisplay: record.Price,
                raw: record // Keep raw data if needed? No, keep it clean.
            };
        })
        .filter(item => item !== null); // Remove invalid records
}

module.exports = { cleanData };
