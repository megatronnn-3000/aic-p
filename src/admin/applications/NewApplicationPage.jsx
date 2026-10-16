import { useNavigate, useOutletContext } from "react-router-dom";
import { FORMS_BY_KEY } from "../../lib/formSchemas";
import { PROGRAMS } from "../../lib/options";
import { useToast } from "../../lib/toast-context";
import { ApplicationWizard } from "../../public/ApplyPage";

/** Staff enter an application on behalf of an applicant (e.g. a paper form). */
export function NewApplicationPage({ program }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshCounts } = useOutletContext() || {};
  const meta = PROGRAMS[program];
  return (
    <ApplicationWizard
      form={FORMS_BY_KEY[program]}
      staff
      backLink={{ to: `${meta.adminBase}/applications`, label: `${meta.name} applications` }}
      onSubmitted={(result) => {
        refreshCounts?.();
        toast.success(`Application ${result.reference} created.`);
        navigate(`${meta.adminBase}/applications/${result.id}`, { replace: true });
      }}
    />
  );
}
