use chrono::TimeDelta;

/// Relative time in the style of Carbon's `diffForHumans()`, e.g. "5 minutes ago".
pub fn ago(elapsed: TimeDelta) -> String {
    let seconds = elapsed.num_seconds().max(1);
    let minutes = seconds / 60;
    let hours = minutes / 60;
    let days = hours / 24;

    let (count, unit) = if seconds < 60 {
        (seconds, "second")
    } else if minutes < 60 {
        (minutes, "minute")
    } else if hours < 24 {
        (hours, "hour")
    } else if days < 7 {
        (days, "day")
    } else if days < 30 {
        (days / 7, "week")
    } else if days < 365 {
        (days / 30, "month")
    } else {
        (days / 365, "year")
    };

    let plural = if count == 1 { "" } else { "s" };
    format!("{count} {unit}{plural} ago")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_each_unit() {
        assert_eq!(ago(TimeDelta::seconds(-5)), "1 second ago");
        assert_eq!(ago(TimeDelta::seconds(0)), "1 second ago");
        assert_eq!(ago(TimeDelta::seconds(59)), "59 seconds ago");
        assert_eq!(ago(TimeDelta::minutes(1)), "1 minute ago");
        assert_eq!(ago(TimeDelta::minutes(5)), "5 minutes ago");
        assert_eq!(ago(TimeDelta::hours(23)), "23 hours ago");
        assert_eq!(ago(TimeDelta::days(1)), "1 day ago");
        assert_eq!(ago(TimeDelta::days(14)), "2 weeks ago");
        assert_eq!(ago(TimeDelta::days(60)), "2 months ago");
        assert_eq!(ago(TimeDelta::days(400)), "1 year ago");
    }
}
