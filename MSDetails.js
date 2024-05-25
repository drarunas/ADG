// MSDetails.js    

function getDetails() {
    const msDetailsRow = document.querySelector("#ms_details_row_author_information");
    if (!msDetailsRow) {
        console.error("The table row with author information was not found.");
        return;
    }
    const table = msDetailsRow.closest("table"); // Find the closest parent table

    // Function to find sibling TD text based on TH text content
    const findDataByText = (headerText) => {
        const th = Array.from(table.querySelectorAll("th")).find(th =>
            th.textContent.includes(headerText)
        );
        return th ? th.nextElementSibling.textContent : "Not found";
    };

    // Utility function to clean text
    const cleanText = (text) => {
        // Remove honorifics and content within parentheses
        let cleanedText = text
            .replace(/\b(Dr|Mr|Ms|Mrs|Miss|Professor)\.?\s+/gi, "")
            .replace(/\(.*?\)/g, "")
            .trim();
        // Additional cleaning for extra spaces within names
        cleanedText = cleanedText.replace(/\s{2,}/g, " ");
        return cleanedText;
    };

    // Function to get names and links by header text
    const getNamesAndLinksByText = (table, headerText) => {
        // Find the row that contains the headerText
        const row = Array.from(table.querySelectorAll("tr")).find(row =>
            Array.from(row.querySelectorAll("th")).some(th => th.textContent.includes(headerText))
        );

        // If the row is found
        if (row) {
            // Find the target cell (td) that contains the values
            const td = row.querySelector("td");
            if (td) {
                const namesAndLinks = [];
                
                // Iterate through the link elements within the td
                td.querySelectorAll("a").forEach(link => {
                    const name = cleanText(link.textContent.trim());
                    const href = link.href;
                    namesAndLinks.push({ name, link: href });
                });
                
                return namesAndLinks;
            } else {
                console.warn("Value cell not found for header:", headerText);
                return [];
            }
        }
        
        console.warn("Header not found:", headerText);
        return [];
    };

    let contributingAuthors = getNamesAndLinksByText(table, "Contributing Author");
    let correspondingAuthors = getNamesAndLinksByText(table, "Corresponding Author");

    const allAuthors = [...correspondingAuthors, ...contributingAuthors];
    return {
        title: findDataByText("Title"),
        abstract: findDataByText("Abstract"),
        authors: allAuthors
    };
}
