// ラジオボタン情報
export type RadioSelectionInfo = {
  name: string;
  value: number;
};

// Props定義
type Props = {
  labelName: string;
  width: number;
  value: string;
  onChange: React.Dispatch<React.SetStateAction<string>>;
};

const CustomTextBox = (props: Props) => {
  return (
    <>
      <label>
        {props.labelName ? `${props.labelName}：` : ''}
        <input
          style={{width: `${props.width}px`}}
          type="text"
          value={props.value}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            props.onChange(event.target.value);
          }}
        />
      </label>
    </>
  );
};
export default CustomTextBox;
