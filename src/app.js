"use strict";
import moment from "moment";
import $ from "jquery";
import "datatables.net";
import "datatables.net-dt/css/dataTables.dataTables.css";

import { d2Get, d2PutJson } from "./js/d2api";

//CSS
import "./css/header.css";
import "./css/style.css";

let table;

window.addEventListener("load", async () => {
    await fetchAndDisplayUsers();
    setupEventListeners();
});

const fetchAndDisplayUsers = async () => {
    try {
        const inactiveDate = getInactiveDate();
        const includeNeverLoggedIn = $("#includeNeverLoggedIn").is(":checked");
        const includeDisabledUsers = $("#includeDisabledUsers").is(":checked");

        let filterCondition = "";

        if (inactiveDate) {
            filterCondition += `lastLogin:lt:${inactiveDate}`;
        }

        if (!includeDisabledUsers) {
            filterCondition += `${filterCondition ? '&' : ''}&filter=disabled:eq:false`;
        }

        // Fetch users based on inactive period and disabled status
        const apiUrl = `/api/users.json?fields=id,username,firstName,surname,disabled,created,lastLogin&paging=false${filterCondition ? `&filter=${filterCondition}` : ""}`;
        const response = await d2Get(apiUrl);

        let users = response.users;

        // Fetch users who never logged in and merge with the existing users
        if (includeNeverLoggedIn) {
            if (!includeDisabledUsers) {
                filterCondition = "&filter=lastLogin:null&filter=disabled:eq:false";
            }
            else {
                filterCondition = "&filter=lastLogin:null";
            }
            const neverLoggedInResponse = await d2Get("/api/users.json?fields=id,username,firstName,surname,disabled,created,lastLogin&paging=false" +  filterCondition);
            users = users.concat(neverLoggedInResponse.users);
        }

        console.log(users.length);
        populateUsersTable(users);
    } catch (error) {
        console.error("Error fetching users: ", error);
    }
};



const populateUsersTable = (users) => {
    // Destroy existing DataTable, unregister event handlers
    if ($.fn.dataTable.isDataTable("#usersTable")) {
        table.destroy();
        $.removeData($("#usersTable")[0]);
        $("#usersTable tbody").off();
    }

    // Clear the table body
    const tableBody = $("#usersTable tbody");
    tableBody.empty();

    users.forEach(user => {
        const disabledText = user.disabled ? "Yes" : "No";
        const disableButton = user.disabled ? "<button class=\"dhis2-button red\" disabled>Disable</button>" : `<button class="dhis2-button red" onclick="window.disableUser('${user.id}')">Disable</button>`;

        const row = `
            <tr data-id="${user.id}">
                <td><input type="checkbox" class="user-select" ${user.disabled ? "disabled" : ""}></td>
                <td>${user.username}</td>
                <td>${user.firstName}</td>
                <td>${user.surname}</td>
                <td>${disabledText}</td>
                <td data-order="${moment(user.created).unix()}">${moment(user.created).format("LL")}</td>
                <td data-order="${user.lastLogin ? moment(user.lastLogin).unix() : 0}">${user.lastLogin ? moment(user.lastLogin).format("LL") : "Never"}</td>
                <td>
                    <div class="actions-buttons">
                        ${disableButton}
                        <button class="dhis2-button" onclick="window.showUserInfo('${user.id}')">Info</button>
                    </div>
                </td>
            </tr>`;
        tableBody.append(row);
    });

    table = $("#usersTable").DataTable({
        searching: true,
        paging: true,
        info: true,
        order: [],
        columnDefs: [
            { targets: [0], orderable: false },
            { targets: [4], orderable: true, type: "string" },
            { targets: [5, 6], type: "num" }
        ],
        responsive: true
    });

    // Select all functionality - applying to all rows across all pages
    $("#select-all").on("click", function () {
        const checked = this.checked;
        table.rows().every(function () {
            $(this.node()).find("input[type='checkbox']").prop("checked", checked);
        });
        updateBulkDisableButtonState(); // Ensuring button state updates
    });

    // Row-level checkbox changes
    $("#usersTable tbody").on("change", "input[type='checkbox'].user-select", function () {
        const el = $("#select-all").get(0);
        if (el && el.checked && !this.checked) {
            el.indeterminate = true;
        } else if (el && el.indeterminate && this.checked) {
            el.indeterminate = false;
        }
        updateBulkDisableButtonState(); // Ensuring button state updates
    });

    // Initial call to set the button state correctly on table population
    updateBulkDisableButtonState();
};






const getInactiveDate = () => {
    const periodType = $("#periodType").val();
    const numPeriods = $("#numPeriods").val();
    const specificDate = $("#specificDate").val();

    if (periodType === "date") {
        return specificDate ? moment(specificDate).toISOString() : moment().subtract(6, "months").toISOString();
    } else if (periodType === "months") {
        return moment().subtract(numPeriods, "months").toISOString();
    } else if (periodType === "years") {
        return moment().subtract(numPeriods, "years").toISOString();
    }
    return null;
};

const applyFilter = async () => {
    await fetchAndDisplayUsers();
};


const setupEventListeners = () => {
    const modal = document.getElementById("user-modal");
    const summaryModal = document.getElementById("summaryModal");
    const confirmationModal = document.getElementById("confirmationModal");
    const progressModal = document.getElementById("progressModal");
    const span = document.getElementsByClassName("close")[0];
    const closeSummarySpan = document.getElementsByClassName("close-summary")[0];
    const closeConfirmSpan = document.getElementsByClassName("close-confirm")[0];
    const closeProgressSpan = document.getElementsByClassName("close-progress")[0];
    const closeSummaryButton = document.getElementById("closeSummaryBtn");
    const closeProgressButton = document.getElementById("closeProgressBtn");
    const confirmBulkDisableButton = document.getElementById("confirmBulkDisableBtn");
    const cancelBulkDisableButton = document.getElementById("cancelBulkDisableBtn");

    // Check for elements before setting onclick
    if (span) { span.onclick = () => modal.style.display = "none"; }
    if (closeSummarySpan) { closeSummarySpan.onclick = () => summaryModal.style.display = "none"; }
    if (closeConfirmSpan) { closeConfirmSpan.onclick = () => confirmationModal.style.display = "none"; }
    if (closeProgressSpan) { closeProgressSpan.onclick = () => progressModal.style.display = "none"; }
    if (closeSummaryButton) { closeSummaryButton.onclick = () => summaryModal.style.display = "none"; }
    if (closeProgressButton) { closeProgressButton.onclick = () => progressModal.style.display = "none"; }
    if (cancelBulkDisableButton) { cancelBulkDisableButton.onclick = () => confirmationModal.style.display = "none"; }

    window.onclick = event => {
        if (event.target === modal) {
            modal.style.display = "none";
        } else if (event.target === summaryModal) {
            summaryModal.style.display = "none";
        } else if (event.target === confirmationModal) {
            confirmationModal.style.display = "none";
        } else if (event.target === progressModal) {
            progressModal.style.display = "none";
        }
    };

    if ($("#bulkDisableBtn")) { $("#bulkDisableBtn").click(showBulkDisableConfirmation); }
    if (confirmBulkDisableButton) { confirmBulkDisableButton.onclick = executeBulkDisable; }
    if ($("#applyFilterBtn")) {
        $("#applyFilterBtn").click(() => {
            applyFilter().then(updateBulkDisableButtonState); // Ensuring button state updates after filter application
        });
    }

    $("#periodType").change(() => {
        const periodType = $("#periodType").val();
        if (periodType === "date") {
            $("#numPeriods").hide();
            $("#specificDate").show();
        } else {
            $("#specificDate").hide();
            $("#numPeriods").show();
        }
    });

    const bulkDisableBtn = document.getElementById("bulkDisableBtn");

    // Check for changes in the checkbox selection
    $("#usersTable tbody").on("change", "input[type='checkbox'].user-select", function () {
        updateBulkDisableButtonState();
    });

    // Select all functionality - applying to all rows across all pages
    $("#select-all").on("click", function () {
        const checked = this.checked;
        table.rows().every(function () {
            $(this.node()).find("input[type='checkbox']").prop("checked", checked);
        });
        updateBulkDisableButtonState();
    });

    // Function to update the state of the bulk disable button
    const updateBulkDisableButtonState = () => {
        const selectedEnabledUserIds = [];
        table.rows().every(function () {
            const rowNode = this.node();
            const isChecked = $(rowNode).find(".user-select").prop("checked");
            const isDisabled = $(rowNode).find(".user-select").prop("disabled");

            if (isChecked && !isDisabled) {
                const userId = $(rowNode).closest("tr").data("id");
                selectedEnabledUserIds.push(userId); // Correctly get user ID
            }
        });

        bulkDisableBtn.disabled = selectedEnabledUserIds.length === 0;
    };

    // Initial call to set the button state correctly on page load
    updateBulkDisableButtonState();
};


const updateBulkDisableButtonState = () => {
    const selectedEnabledUserIds = [];
    table.rows().every(function () {
        const rowNode = this.node();
        const isChecked = $(rowNode).find(".user-select").prop("checked");
        const isDisabled = $(rowNode).find(".user-select").prop("disabled");

        if (isChecked && !isDisabled) {
            const userId = $(rowNode).closest("tr").data("id");
            selectedEnabledUserIds.push(userId); // Correctly get user ID
        }
    });
    const bulkDisableBtn = document.getElementById("bulkDisableBtn");
    bulkDisableBtn.disabled = selectedEnabledUserIds.length === 0;
};


const showBulkDisableConfirmation = () => {
    const selectedUserIds = [];
    table.rows().every(function () {
        const rowNode = this.node();
        const isChecked = $(rowNode).find(".user-select").prop("checked");
        const isDisabled = $(rowNode).find(".user-select").prop("disabled");

        if (isChecked && !isDisabled) {
            const userId = $(rowNode).closest("tr").data("id");
            selectedUserIds.push(userId); // Correctly get user ID
        }
    });

    const count = selectedUserIds.length;
    if (count > 0) {
        $("#confirmationContent").html(`<p>${count} user(s) will be disabled. Do you want to continue?</p>`);
        $("#confirmationModal").css("display", "block");
    } else {
        alert("No valid users selected for disabling.");
    }
};


const executeBulkDisable = async () => {
    const selectedUserIds = [];
    table.rows().every(function () {
        const rowNode = this.node();
        const isChecked = $(rowNode).find(".user-select").prop("checked");
        const isDisabled = $(rowNode).find(".user-select").prop("disabled");

        if (isChecked && !isDisabled) {
            const userId = $(rowNode).closest("tr").data("id");
            selectedUserIds.push(userId);
        }
    });

    const userCount = selectedUserIds.length;
    let successCount = 0;
    let failures = [];

    // Close the confirmation modal and open the progress modal
    $("#confirmationModal").css("display", "none");
    $("#progressModal").css("display", "block");

    for (const userId of selectedUserIds) {
        const result = await window.disableUser(userId);
        if (result.status === "success") {
            successCount++;
        } else {
            failures.push(result);
        }
        // Update progress modal
        $("#progressContent").html(`<p>${successCount + failures.length} of ${userCount} users updated...</p>`);
    }

    showSummaryModal(successCount, failures);
    await fetchAndDisplayUsers();
    $("#progressModal").css("display", "none");
};


const showSummaryModal = (successCount, failures) => {
    const modal = document.getElementById("summaryModal");
    const summaryContent = document.getElementById("summaryContent");

    summaryContent.innerHTML = `<p>${successCount} users were successfully processed.</p>`;

    if (failures.length > 0) {
        const table = document.createElement("table");
        table.classList.add("result-table");
        const header = document.createElement("tr");
        header.innerHTML = "<th>UserID</th><th>Status</th><th>Message</th>";
        table.appendChild(header);

        failures.forEach(result => {
            const row = document.createElement("tr");
            row.innerHTML = `<td>${result.userId}</td><td>${result.status}</td><td>${result.message}</td>`;
            table.appendChild(row);
        });

        summaryContent.appendChild(table);
    }

    modal.style.display = "block";
};

window.disableUser = async (userId) => {
    try {
        const userResponse = await d2Get(`/api/users/${userId}.json?fields=:owner`);
        const user = userResponse;

        user.disabled = true;

        await d2PutJson(`/api/users/${userId}`, user);

        const row = $(`tr[data-id='${userId}']`);
        row.find("td").eq(4).html("Yes");

        return { userId, status: "success" };
    } catch (error) {
        const errorMessage = error;
        return { userId, status: "error", message: errorMessage };
    }
};




window.showUserInfo = async (userId) => {
    try {
        const userResponse = await d2Get(`/api/users/${userId}.json?fields=id,username,firstName,surname,disabled,created,lastLogin,userRoles[id,name],userGroups[id,name],organisationUnits[id,name]`);
        const user = userResponse;

        document.getElementById("userInfo").innerHTML = `
            <p><strong>Username:</strong> ${user.username}</p>
            <p><strong>First Name:</strong> ${user.firstName}</p>
            <p><strong>Surname:</strong> ${user.surname}</p>
            <p><strong>Disabled:</strong> ${user.disabled ? "Yes" : "No"}</p>
            <p><strong>Created:</strong> ${moment(user.created).format("LL")}</p>
            <p><strong>Last Login:</strong> ${user.lastLogin ? moment(user.lastLogin).format("LL") : "Never"}</p>
            <p><strong>User Roles:</strong> ${user.userRoles.map(role => role.name).join(", ")}</p>
            <p><strong>User Groups:</strong> ${user.userGroups.map(group => group.name).join(", ")}</p>
            <p><strong>Organisation Units:</strong> ${user.organisationUnits.map(ou => ou.name).join(", ")}</p>`;

        const modal = document.getElementById("user-modal");
        modal.style.display = "block";
    } catch (error) {
        showErrorModal(error);
    }
};

const showErrorModal = (error) => {
    alert(`Error: ${error.message}`);
};

