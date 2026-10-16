-- Schema produced by the original single-file backend (git HEAD before the rebuild).
-- Used by tests/test_legacy_upgrade.py.

CREATE TABLE document_repository (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            startup TEXT,
            pitch_deck TEXT, pan TEXT, gst TEXT, mou TEXT, aoa TEXT,
            startup_india TEXT, bank_statement TEXT, ip TEXT, agreements TEXT,
            reports TEXT, funding TEXT, investor_deck TEXT, meeting_minutes TEXT,
            created_at TEXT
        );

CREATE TABLE founder_crm (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            founder_name TEXT, photo TEXT, email TEXT, phone TEXT, linkedin TEXT,
            education TEXT, experience TEXT, skills TEXT, startup TEXT, co_founder TEXT,
            equity TEXT, pan TEXT, aadhaar TEXT, kyc_status TEXT,
            meeting_history TEXT, mentorship_history TEXT, funding_history TEXT, performance_notes TEXT,
            created_at TEXT
        );

CREATE TABLE incubation_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            startupName TEXT, email TEXT, mobileNo TEXT, state TEXT, city TEXT,
            sector TEXT, incubateeLevel TEXT, typeOfProgram TEXT, operationalModel TEXT,
            govtProgramme TEXT, msmeRegistered TEXT, dippRegistered TEXT, sdgGoals TEXT,
            description TEXT, pptFilename TEXT, submitted_at TEXT
        , evaluation_data TEXT);

CREATE TABLE incubation_evaluations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            evaluator_name TEXT NOT NULL,
            evaluation_data TEXT,
            updated_at TEXT
        );

CREATE TABLE internship_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT, email TEXT, phone TEXT,
            department TEXT, year_of_study TEXT, preferred_role TEXT,
            why_interested TEXT, skills_experience TEXT,
            hosteller_status TEXT, willing_late TEXT,
            cv_filename TEXT, submitted_at TEXT
        , is_past_intern TEXT DEFAULT 'No');

CREATE TABLE module_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module TEXT, category TEXT,
            title TEXT, description TEXT,
            contact_name TEXT, contact_email TEXT, contact_phone TEXT,
            record_date TEXT, status TEXT, notes TEXT, attachment TEXT,
            created_at TEXT
        );

CREATE TABLE startup_crm (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            startup_id TEXT, startup_name TEXT, logo TEXT, founder TEXT, co_founder TEXT,
            email TEXT, phone TEXT, website TEXT, linkedin TEXT,
            startup_india_number TEXT, dpiit_number TEXT, cin TEXT, gst TEXT, pan TEXT,
            sector TEXT, sub_sector TEXT, technology TEXT, trl_level TEXT,
            incubation_stage TEXT, current_status TEXT, revenue TEXT, customers TEXT,
            employees TEXT, valuation TEXT, investment_raised TEXT, burn_rate TEXT, runway TEXT,
            assigned_mentor TEXT, assigned_rm TEXT, current_milestone TEXT,
            risk_score TEXT, graduation_score TEXT, next_review_date TEXT, remarks TEXT,
            city TEXT, address TEXT,
            created_at TEXT
        );

CREATE TABLE startups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- Applicant Details
        name TEXT,
        email TEXT,
        gender TEXT,
        dob TEXT,
        address TEXT,
        contact_number TEXT,
        native_state TEXT,
        highest_qualification TEXT,
        professional_experience TEXT,

        -- Startup Details
        startup_name TEXT,
        company_type TEXT,
        incorporation_date TEXT,
        cin TEXT,
        office_address TEXT,
        gst_number TEXT,
        dpiit_number TEXT,
        sector TEXT,
        startup_stage TEXT,
        problem_statement TEXT,
        value_proposition TEXT,
        usp TEXT,
        target_customer TEXT,
        competitors TEXT,
        scale_up_plan TEXT,
        revenue_model TEXT,
        market_size TEXT,
        website_url TEXT,
        social_media_links TEXT,
        video_url TEXT,
        govt_support TEXT,
        seed_support TEXT,

        -- Team Details
        founder_name TEXT,
        co_founder_name TEXT,
        team_emails TEXT,
        team_contacts TEXT,
        linkedin_profiles TEXT,
        full_time_employees TEXT,

        -- Incubator Requirement
        why_applying TEXT,
        expectations TEXT,
        funds_required TEXT,
        funding_requirement TEXT,

        -- File uploads (existing)
        pitch_deck TEXT,
        resume TEXT,
        pan_card TEXT,
        certificate TEXT,
        business_plan TEXT,
        other_document TEXT,

        status TEXT DEFAULT 'Pending'
    , pitch_date TEXT, pitch_time TEXT, pitch_link TEXT, certificate_status TEXT DEFAULT 'Not Issued', is_active TEXT DEFAULT 'Yes', evaluation_data TEXT);
